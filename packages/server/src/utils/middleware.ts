// 鉴权中间件（对应 app/middleware/UserAuth.php、AdminAuth.php）
// 老项目的 Session 状态（小程序端携带 Cookie）未移植，统一走 Authorization: Bearer token
import type {MiddlewareHandler} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {verifyToken} from './auth.js';
import type {UserRow} from '../models/user.js';

export type AuthVars = { user: UserRow };

/** UserAuth：未登录返回 401 */
export const userAuth: MiddlewareHandler<{ Variables: AuthVars }> = async (c, next) => {
  const user = await verifyToken(c.req.header('Authorization'));
  if (!user) throw new HTTPException(401, {res: new Response('401 Unauthorized', {status: 401})});
  c.set('user', user);
  await next();
};

/** AdminAuth：要求 is_admin */
export const adminAuth: MiddlewareHandler<{ Variables: AuthVars }> = async (c, next) => {
  const user = await verifyToken(c.req.header('Authorization'));
  if (!user || !user.is_admin) {
    throw new HTTPException(401, {res: new Response('401 Unauthorized', {status: 401})});
  }
  c.set('user', user);
  await next();
};
