// 通用扫码会话路由（一共三个接口）
//
//   POST /api/v1/qr/sessions               申请一张一次性二维码（任意设备 / 网页）
//   GET  /api/v1/qr/sessions/:token/events 订阅会话变化（SSE：授权 / 过期即时推送）
//   POST /api/v1/auth/qr-authorize         小程序授权（在 auth.routes.js）
//
// 小程序侧不查询会话：用途（action）和有效期（ttl）都写在二维码 URL 的参数里，
// 页面本地就能决定文案与倒计时；二维码是否还有效，等点「授权」时由 qr-authorize
// 用 404（无效）/ 410（过期）/ 409（已被占用）告诉它，少一次往返。
//
// action 目前有两种：login（其他设备/网页扫码登录）与 face_bind（一体机绑定人脸）。
// 新增用途只需扩展 QrAction，具体业务拿到凭据后自己去做，路由层不关心业务细节。
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { db } from '../../db/client.js';
import { config } from '../../config.js';
import { AppError, ok } from '../../utils/responses.js';
import { generateToken } from '../../utils/auth.js';
import { findUser } from '../../models/user.js';
import {
  createSession,
  getSession,
  watchSession,
  remainSeconds,
  QrAction,
  QrStatus,
  QR_ACTIONS,
} from '../../services/qrSession.js';
import { rateLimit } from '../../utils/rateLimit.js';

export const qrRouter = new Hono();

/** SSE 心跳间隔：反向代理和移动网络都会掐掉长时间没数据的连接 */
const SSE_HEARTBEAT_MS = 15_000;

/**
 * 二维码落地地址：微信扫普通链接二维码后按小程序后台配置打开 pages/index/login。
 *
 * 把 action 和有效期一起带在 URL 上，小程序不用先查一次接口就知道该显示什么、
 * 该倒计时多久。
 */
export function buildQrUrl(token, action, ttl) {
  const base = config.qr.qrBaseUrl.replace(/\/+$/, '');
  return `${base}/login?qr=${token}&a=${encodeURIComponent(action)}&t=${ttl}`;
}

/**
 * POST /api/v1/qr/sessions
 * 入参：{ action?: 'login'|'face_bind', device?: string, meta?: object }
 */
qrRouter.post('/sessions', rateLimit({ name: 'qr-sessions', max: 60 }), async (c) => {
  // 申请二维码的 body 只应有 action/device/meta 之类的小字段
  const declaredSize = Number(c.req.header('content-length') || 0);
  if (declaredSize > 8 * 1024) {
    throw new AppError('请求体过大', 413);
  }

  const payload = await c.req.json().catch(() => ({}));
  const action = typeof payload?.action === 'string' ? payload.action : QrAction.LOGIN;

  if (!QR_ACTIONS.includes(action)) {
    throw new AppError(`不支持的扫码用途: ${action}`);
  }

  // meta 会一直留在内存里直到会话过期，限制体积，避免被塞大对象
  if (payload?.meta !== undefined) {
    let metaStr = '';
    try {
      metaStr = JSON.stringify(payload.meta);
    } catch {
      throw new AppError('meta 必须是可序列化的对象');
    }
    if (metaStr.length > 2048) {
      throw new AppError('meta 过大（最大 2KB）');
    }
  }

  const session = createSession({
    action,
    device: typeof payload?.device === 'string' ? payload.device.slice(0, 64) : '',
    meta: payload?.meta,
  });

  if (session.device) {
    console.log(`[QrSession] ${session.device} 申请 ${action} 二维码 ${session.token}`);
  }

  const expireIn = remainSeconds(session);

  return c.json(
    ok({
      qr_token: session.token,
      qr_url: buildQrUrl(session.token, session.action, expireIn),
      action: session.action,
      expire_in: expireIn,
    })
  );
});

/**
 * 组装会话对外的状态快照，SSE 事件用。
 * @param {object} session
 */
async function buildPayload(session) {
  const data = {
    status: session.status,
    action: session.action,
    expire_in: remainSeconds(session),
    account: null,
    token: null,
  };

  if (session.user_id) {
    const user = await findUser(db, session.user_id);
    if (user) {
      data.account = {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar || '',
      };
    }
    // 会话绑定账号后就下发统一登录令牌
    data.token = await generateToken(session.user_id);
  }

  return data;
}

/**
 * GET /api/v1/qr/sessions/:token/events
 * SSE：扫码、授权、过期都由服务端主动推给发起方，这是发起方唯一的等待通道。
 *
 * 事件名与含义：
 *   state      连接后立刻推一份当前快照（客户端据此决定继续等还是要重生成）
 *   authorized 小程序已完成授权，payload 带统一登录令牌；推完即关流
 *   expired    二维码到期，服务端主动结束这条流
 *   ping       心跳，仅用于保活，可忽略
 */
qrRouter.get('/sessions/:token/events', async (c) => {
  const token = c.req.param('token');
  const session = getSession(token);

  if (!session) {
    throw new AppError('二维码无效，请重新生成', 404, { status: QrStatus.EXPIRED });
  }

  // 关键：告诉 Nginx 这类反向代理不要缓冲，否则事件会被攒到连接关闭才吐出来，
  // 表现就是「明明授权了，大屏一直不动」
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    let closed = false;

    const send = async (event, payload) => {
      if (closed) return;
      try {
        await stream.writeSSE({
          event,
          id: `${payload.status}-${Date.now()}`,
          data: JSON.stringify(payload),
        });
      } catch {
        // 客户端已经断开，等 onAbort 收尾即可
      }
    };

    // 连上先给一份快照
    const snapshot = await buildPayload(session);
    await send('state', snapshot);

    // 已经授权过的会话：补一份令牌后就可以收工
    if (session.status === QrStatus.AUTHORIZED) {
      closed = true;
      return;
    }

    let finish = () => {};
    const done = new Promise((resolve) => {
      finish = resolve;
    });

    let sentAuthorized = false;
    const pushAuthorized = async (latest) => {
      if (sentAuthorized) return;
      sentAuthorized = true;
      const payload = await buildPayload(latest).catch(() => null);
      if (!payload) {
        finish();
        return;
      }
      await send('authorized', payload);
      // 授权就是这次扫码的终点：令牌已经给到发起方，这条流不必再挂着
      finish();
    };

    const stopWatch = watchSession(token, (latest) => {
      if (latest.status === QrStatus.AUTHORIZED) {
        pushAuthorized(latest);
      }
    });

    // 双检：从读快照到注册订阅之间如果刚好被授权，事件就漏了，这里补一次
    const current = getSession(token);
    if (current && current.status === QrStatus.AUTHORIZED) {
      await pushAuthorized(current);
    }

    // 到期由服务端主动通知，客户端不用自己算时间
    const expireTimer = setTimeout(async () => {
      const latest = getSession(token);
      if (latest && latest.status === QrStatus.EXPIRED) {
        await send('expired', { ...snapshot, status: QrStatus.EXPIRED, expire_in: 0, token: null });
      }
      finish();
    }, Math.max(0, session.expire_at - Date.now()));

    const heartbeat = setInterval(() => {
      if (closed) return;
      stream.writeSSE({ event: 'ping', data: '{}' }).catch(() => {});
    }, SSE_HEARTBEAT_MS);

    stream.onAbort(() => {
      closed = true;
      finish();
    });

    await done;

    closed = true;
    clearInterval(heartbeat);
    clearTimeout(expireTimer);
    stopWatch();
  });
});
