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

const app = new Hono();

// 1. 全局异常处理
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  if (err instanceof AppError) {
    return c.json({
      code: 0,
      msg: err.message,
      data: config.app.debug ? err.stack : null,
      ...(err.extra || {}),
    });
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

// 3. 根路径与老商户后台兼容通道
app.get('/', (c) => c.text('MUG & TCG Arcade Backend v2.0 (Pure JS)'));
app.post('/wepay/callback', async (c) => {
  return walletRouter.fetch(
    new Request('http://localhost/wechat-pay/notify', {
      method: 'POST',
      headers: c.req.raw.headers,
      body: await c.req.text(),
    })
  );
});

// 4. 全新 RESTful API 路由装载（统一 /api/v1 命名空间）
const v1 = new Hono();
v1.route('/auth', authRouter);
v1.route('/user', userRouter);
v1.route('/wallet', walletRouter);
v1.route('/arcade', arcadeRouter);
v1.route('/tcg', tcgRouter);
v1.route('/common', commonRouter);
v1.route('/admin', adminRouter);

app.route('/api/v1', v1);

export default app;
