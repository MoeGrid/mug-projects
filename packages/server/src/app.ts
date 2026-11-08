// 应用入口（对应老项目公共中间件 + ExceptionHandle + 路由装载）
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {config} from './config.js';
import {AppError} from './utils/responses.js';
import type {UserRow} from './models/user.js';
import {webRouter} from './routes/web.js';
import {userRouter} from './routes/user.js';
import {adminUserRouter} from './routes/admin.js';

// 上下文环境变量（userAuth/adminAuth 注入当前用户）
export type Env = { Variables: { user: UserRow } };

const app = new Hono<Env>();

// 全局异常处理（对应老项目 ExceptionHandle::render：业务异常一律 HTTP 200 + {code:0, msg}）
app.onError((err, c) => {
  // 真正的 HTTP 语义异常（如未登录 401）保持原状态码，小程序有专门分支处理
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  // 业务错误：HTTP 200 + {code:0, msg}（小程序 _ajax 只在 200 才读 code/msg）
  if (err instanceof AppError) {
    return c.json({code: 0, msg: err.message, data: config.app.debug ? err.stack : null});
  }
  // 未预期的崩溃：记日志 + 500（便于监控/告警），不暴露堆栈给前端
  console.error(err);
  return c.json({code: 0, msg: config.app.debug ? err.message : '页面错误！请稍后再试～'}, 500);
});

// 路由装载（顺序对齐老项目：web → app(用户端) → admin）
app.route('/', webRouter);
app.route('/', userRouter);
app.route('/', adminUserRouter);

export default app;
