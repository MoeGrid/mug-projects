import { post } from './client'

/**
 * 微信静默登录
 * @param {string} code 微信临时凭据
 */
export function wechatLogin(code) {
  return post('/api/v1/auth/wechat-login', { code })
}

export const login = wechatLogin
