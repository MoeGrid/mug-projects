import { post } from './client'

/** 扫码用途：扫码登录 / 一体机绑定人脸 */
export const QR_ACTION = {
  LOGIN: 'login',
  FACE_BIND: 'face_bind',
}

/**
 * 授权：把这次扫码会话绑定到当前微信账号（需要登录态）
 * 具体用途由服务端会话里的 action 决定
 *
 * 失败时抛出的 Error 带 status：
 *   404 二维码无效 / 410 已过期 / 409 已被其他账号使用
 * @param {string} qr 二维码携带的一次性 token
 */
export function authorizeQr(qr) {
  return post('/api/v1/auth/qr-authorize', { qr })
}
