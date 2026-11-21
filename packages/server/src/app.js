// 全新纯 JS 架构应用编排入口
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './config.js';
import { AppError } from './utils/responses.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { walletRouter } from './modules/wallet/wallet.routes.js';
import { arcadeRouter } from './modules/arcade/arcade.routes.js';
import { tcgRouter } from './modules/tcg/tcg.routes.js';
import { commonRouter } from './modules/common/common.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { qrRouter } from './modules/qr/qr.routes.js';

const app = new Hono();

// 1. 全局异常处理
// 约定：错误一律返回 { code: 0, msg } + 真实的 HTTP 状态码，
// 不再把业务错误包装成 HTTP 200（否则客户端无法用 status 区分「参数错 / 无权限 / 过期」）。
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    // 401/403/404 等：Hono 默认返回纯文本，这里统一成 JSON，客户端才能显示中文原因
    return c.json({ code: 0, msg: err.message || '请求失败' }, err.status);
  }
  if (err instanceof AppError) {
    const status = err.status >= 400 && err.status < 600 ? err.status : 400;
    return c.json(
      {
        code: 0,
        msg: err.message,
        data: config.app.debug ? err.stack : null,
        ...(err.extra || {}),
      },
      status
    );
  }
  console.error('[UNCAUGHT_ERROR]:', err);
  return c.json({ code: 0, msg: config.app.debug ? err.message : '页面错误！请稍后再试～' }, 500);
});

// 2. 静态资源托管：仅开放 /storage/* 且严格映射到 STORAGE_ROOT
app.use(
  '/storage/*',
  serveStatic({
    root: config.fs.publicRoot,
    rewriteRequestPath: (p) => p.replace(/^\/storage/, ''),
  })
);

// 3. 根路径
app.get('/', (c) => c.text('MUG & TCG Arcade Backend v2.0 (Pure JS)'));

// 4. 全新 RESTful API 路由装载（统一 /api/v1 命名空间）
const v1 = new Hono();
v1.route('/auth', authRouter);
v1.route('/user', userRouter);
v1.route('/wallet', walletRouter);
v1.route('/arcade', arcadeRouter);
v1.route('/tcg', tcgRouter);
v1.route('/common', commonRouter);
v1.route('/admin', adminRouter);
v1.route('/qr', qrRouter);

app.route('/api/v1', v1);

// 5. 未命中路由：统一 JSON（否则 Hono 返回纯文本 "404 Not Found"，客户端只能显示「网络错误: 404」）
app.notFound((c) => c.json({ code: 0, msg: '接口不存在' }, 404));

export default app;
