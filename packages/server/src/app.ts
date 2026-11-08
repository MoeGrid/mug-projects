// 全新现代架构应用编排入口
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {serveStatic} from '@hono/node-server/serve-static';
import {config} from './config.js';
import {AppError} from './utils/responses.js';
import type {UserRow} from './models/user.js';

// 引入六大领域模块路由
import {authRouter} from './modules/auth/auth.routes.js';
import {userRouter} from './modules/user/user.routes.js';
import {walletRouter} from './modules/wallet/wallet.routes.js';
import {arcadeRouter} from './modules/arcade/arcade.routes.js';
import {tcgRouter} from './modules/tcg/tcg.routes.js';
import {commonRouter} from './modules/common/common.routes.js';
import {adminRouter} from './modules/admin/admin.routes.js';

// 上下文环境变量（注入当前登录用户）
export type Env = { Variables: { user: UserRow } };

const app = new Hono<Env>();

// ---------------------------------------------------------------------------
// 1. 全局异常处理中间件
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  if (err instanceof AppError) {
    return c.json({code: 0, msg: err.message, data: config.app.debug ? err.stack : null});
  }
  console.error('[UNCAUGHT_ERROR]:', err);
  return c.json({code: 0, msg: config.app.debug ? err.message : '页面错误！请稍后再试～'}, 500);
});

// ---------------------------------------------------------------------------
// 2. 静态资源托管：仅向外开放 /storage/* 且严格映射到 STORAGE_ROOT
// ---------------------------------------------------------------------------
app.use(
  '/storage/*',
  serveStatic({
    root: config.fs.publicRoot,
    rewriteRequestPath: (p) => p.replace(/^\/storage/, ''),
  })
);

// ---------------------------------------------------------------------------
// 3. 根路径与微信支付回调兼容通道
// ---------------------------------------------------------------------------
app.get('/', (c) => c.text('MUG & TCG Arcade Backend v2.0'));
// 兼容老微信商户后台登记的旧回调地址 /wepay/callback
app.post('/wepay/callback', async (c) => {
  return walletRouter.fetch(new Request('http://localhost/wechat-pay/notify', {
    method: 'POST',
    headers: c.req.raw.headers,
    body: await c.req.text(),
  }));
});

// ---------------------------------------------------------------------------
// 4. 全新 RESTful API 路由装载（统一 /api/v1 命名空间）
// ---------------------------------------------------------------------------
const v1 = new Hono<Env>();
v1.route('/auth', authRouter);
v1.route('/user', userRouter);
v1.route('/wallet', walletRouter);
v1.route('/arcade', arcadeRouter);
v1.route('/tcg', tcgRouter);
v1.route('/common', commonRouter);
v1.route('/admin', adminRouter);

app.route('/api/v1', v1);

export default app;
