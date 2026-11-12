// 统一响应格式
export class AppError extends Error {
  constructor(message, statusOrExtra = 400, extra = {}) {
    super(message);
    this.name = 'AppError';
    if (typeof statusOrExtra === 'object' && statusOrExtra !== null) {
      this.status = 400;
      this.extra = statusOrExtra;
    } else {
      this.status = typeof statusOrExtra === 'number' ? statusOrExtra : 400;
      this.extra = typeof extra === 'object' && extra !== null ? extra : {};
    }
  }
}

/**
 * 成功返回包装
 * @param {any} data
 */
export function ok(data) {
  return { code: 1, data };
}

/**
 * 业务错误返回包装
 * @param {string} msg
 */
export function fail(msg) {
  return { code: 0, msg };
}
