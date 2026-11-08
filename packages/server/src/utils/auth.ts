// 登录令牌：改用 Hono 内置 JWT（hono/utils/jwt，基于 Node 原生 crypto.subtle，零额外依赖）。
// 取代原手搓的 AES-256-GCM 方案；因迁移期已对密钥做 sha256 派生、旧 PHP token 本就验证不了，
// 故切换 token 格式无向后兼容负担（用户重新登录一次即可）。
import {Jwt} from 'hono/utils/jwt';
import {config} from '../config.js';
import {db} from '../db/client.js';
import {findUser, type UserRow} from '../models/user.js';

const ALG = 'HS256';

/** Auth::generate($uid) —— 签发 JWT，载荷 { uid, exp(秒) } */
export async function generateToken(uid: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + config.token.expire;
  return Jwt.sign({uid, exp}, config.token.secret, ALG);
}

/**
 * Auth::verify() —— 从 Authorization: Bearer <token> 解析并加载用户。
 * Jwt.verify 自动校验签名与 exp（过期即抛错），这里统一归为 null。
 * 改用 JWT 标准 exp 后过期真正生效。
 */
export async function verifyToken(authorization: string | undefined): Promise<UserRow | null> {
  if (!authorization) return null;
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  try {
    const payload = await Jwt.verify(parts[1], config.token.secret, ALG);
    const uid = Number(payload.uid);
    if (!Number.isInteger(uid)) return null;
    return (await findUser(db, uid)) ?? null;
  } catch {
    return null; // 签名错误 / 已过期 / 格式非法
  }
}
