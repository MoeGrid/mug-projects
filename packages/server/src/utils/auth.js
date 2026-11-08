// JWT 认证令牌
import crypto from 'node:crypto';
import { config } from '../config.js';

function base64Url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return Buffer.from(b64, 'base64');
}

function hmacSha256(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

/** 签发 JWT */
export async function generateToken(userId) {
  const header = base64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        uid: userId,
        iat: now,
        exp: now + config.token.expire,
      })
    )
  );
  const signature = base64Url(hmacSha256(`${header}.${payload}`, config.token.secret));
  return `${header}.${payload}.${signature}`;
}

/** 校验 JWT 并提取 userId */
export async function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = base64Url(hmacSha256(`${header}.${payload}`, config.token.secret));
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    const data = JSON.parse(base64UrlDecode(payload).toString('utf8'));
    if (typeof data.exp === 'number' && Math.floor(Date.now() / 1000) > data.exp) {
      return null;
    }
    return typeof data.uid === 'number' ? data.uid : null;
  } catch {
    return null;
  }
}
