// 鉴权中间件
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.js';
import { verifyToken } from './auth.js';
import { findUser } from '../models/user.js';

function extractBearer(c) {
  const h = c.req.header('authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** 用户端认证中间件（401 HTTP 状态码） */
export async function userAuth(c, next) {
  const token = extractBearer(c);
  if (!token) throw new HTTPException(401, { message: '请先登录' });
  const uid = await verifyToken(token);
  if (!uid) throw new HTTPException(401, { message: '登录已过期' });
  const user = await findUser(db, uid);
  if (!user) throw new HTTPException(401, { message: '用户不存在' });
  c.set('user', user);
  await next();
}

/** 管理端认证中间件 */
export async function adminAuth(c, next) {
  await userAuth(c, async () => {
    const user = c.get('user');
    if (!user || !user.is_admin) {
      throw new HTTPException(403, { message: '无管理员权限' });
    }
    await next();
  });
}
