// 轻量级内存限流（单实例；与 qrSession 一样，多副本部署时需换 Redis）
//
// 用途：给「人脸登录 / 微信登录 / 申请二维码」这类无需登录或被高频调用的端点兜底，
// 防止被脚本刷爆外部付费服务（InsightFace、微信接口）或耗尽内存。
//
// 说明：
// - 固定窗口计数，按「客户端 IP + 端点名」分桶；
// - 部署在 Nginx 后面时优先取 X-Forwarded-For 的第一个地址；
// - 超限返回 429 + Retry-After，并保持统一 JSON 错误结构。

/** @type {Map<string, {count: number, resetAt: number}>} */
const buckets = new Map();

function clientIp(c) {
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || 'unknown';
}

/**
 * @param {{name: string, windowMs?: number, max?: number}} options
 * @returns {import('hono').MiddlewareHandler}
 */
export function rateLimit({ name, windowMs = 60_000, max = 30 }) {
  if (!name) throw new Error('rateLimit 需要 name');

  return async (c, next) => {
    const key = `${name}:${clientIp(c)}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header('Retry-After', String(retryAfter));
      return c.json({ code: 0, msg: '操作过于频繁，请稍后再试' }, 429);
    }

    await next();
  };
}

// 每分钟清理过期桶，避免长期运行时 Map 无限增长
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, 60_000);
if (typeof sweeper.unref === 'function') sweeper.unref();
