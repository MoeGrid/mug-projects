// 统一响应格式
export class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AppError';
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
