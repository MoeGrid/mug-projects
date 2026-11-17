// 扫码会话（通用）：二维码登录 / 扫码授权一次具体动作
//
// 这是一个通用能力，不绑定人脸：
//   1. 任意设备或网页调用 POST /api/v1/qr/sessions 申请一张一次性二维码（带 action）
//   2. 用户用微信扫码 → 小程序授权 → 会话绑定到该账号
//   3. 发起方订阅 GET /api/v1/qr/sessions/:token/events（SSE），授权结果由服务端推过来
//
// action 决定「拿到什么凭据」和「小程序上显示什么」，新增用途只要加一个 action：
//   - login      其他设备 / 网页扫码登录 → 拿到统一登录令牌
//   - face_bind  一体机扫码绑定人脸     → 同样是统一登录令牌，公共设备用完即弃
//
// 会话只存活几分钟，属于极短生命周期数据，直接放进程内存：不建表、不写库，
// 进程重启后二维码自然失效（重新生成即可）。多实例部署时把本文件换成 Redis 实现即可。
import crypto from 'node:crypto';
import { config } from '../config.js';

/** 扫码用途 */
export const QrAction = {
  LOGIN: 'login',
  FACE_BIND: 'face_bind',
};

export const QR_ACTIONS = Object.values(QrAction);

/** pending 未扫码 / authorized 已授权 / expired 已过期（授权即终点，没有「完成」这一步） */
export const QrStatus = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  EXPIRED: 'expired',
};

/** @type {Map<string, object>} */
const sessions = new Map();

/**
 * token -> Set<listener>：SSE 长连接的订阅者。
 * 会话状态一变就主动推给它，不用客户端来问。
 * @type {Map<string, Set<(session: object) => void>>}
 */
const watchers = new Map();

function now() {
  return Date.now();
}

/**
 * 订阅会话状态变化。
 * @param {string} token
 * @param {(session: object) => void} listener
 * @returns {() => void} 取消订阅
 */
export function watchSession(token, listener) {
  let set = watchers.get(token);
  if (!set) {
    set = new Set();
    watchers.set(token, set);
  }
  set.add(listener);

  return () => {
    set.delete(listener);
    if (set.size === 0) watchers.delete(token);
  };
}

/** 通知订阅者（回调里通常做 IO，异常不能影响其它订阅者） */
function notify(session) {
  const set = watchers.get(session.token);
  if (!set || set.size === 0) return;
  for (const listener of [...set]) {
    try {
      listener(session);
    } catch (e) {
      console.error('[QrSession] 订阅回调异常', e);
    }
  }
}

/** 惰性过期：读取时判断，避免依赖定时器精度 */
function touch(session) {
  if (!session) return null;
  if (session.status !== QrStatus.EXPIRED && now() > session.expire_at) {
    session.status = QrStatus.EXPIRED;
  }
  return session;
}

/**
 * 创建扫码会话
 * @param {{action?: string, device?: string, meta?: object, ttlSeconds?: number}} options
 */
export function createSession(options = {}) {
  const action = QR_ACTIONS.includes(options.action) ? options.action : QrAction.LOGIN;
  const token = crypto.randomBytes(16).toString('hex');
  const created = now();
  const ttl = options.ttlSeconds || config.qr.expire;

  const session = {
    token,
    action,
    device: options.device || '',
    meta: options.meta && typeof options.meta === 'object' ? options.meta : {},
    status: QrStatus.PENDING,
    user_id: null,
    created_at: created,
    expire_at: created + ttl * 1000,
    authorized_at: null,
  };
  sessions.set(token, session);
  return session;
}

export function getSession(token) {
  if (!token) return null;
  return touch(sessions.get(token));
}

/** 小程序授权：只允许 pending 会话被绑定一次，防止二维码被多个人抢绑 */
export function bindSession(token, userId) {
  const session = touch(sessions.get(token));
  if (!session) return { ok: false, reason: 'not_found' };
  if (session.status === QrStatus.EXPIRED) return { ok: false, reason: 'expired' };
  if (session.status === QrStatus.AUTHORIZED) {
    // 同一账号重复点击授权视为幂等成功，其他人则拒绝
    return session.user_id === userId ? { ok: true, session } : { ok: false, reason: 'taken' };
  }
  session.user_id = userId;
  session.status = QrStatus.AUTHORIZED;
  session.authorized_at = now();
  // 推送出去，SSE 客户端立刻拿到结果
  notify(session);
  return { ok: true, session };
}


/** 剩余有效秒数（对外展示用，过期返回 0） */
export function remainSeconds(session) {
  if (!session) return 0;
  return Math.max(0, Math.ceil((session.expire_at - now()) / 1000));
}

// 每分钟清理一次过期很久的会话，避免长时间运行内存里堆积
const sweeper = setInterval(() => {
  const deadline = now() - 10 * 60 * 1000;
  for (const [token, session] of sessions) {
    if (session.expire_at < deadline) sessions.delete(token);
  }
}, 60 * 1000);
if (typeof sweeper.unref === 'function') sweeper.unref();
