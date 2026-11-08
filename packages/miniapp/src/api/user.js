import { get, put } from './client'

/**
 * 获取当前用户资料
 */
export function getUserProfile() {
  return get('/api/v1/user/profile')
}

/**
 * 更新用户个人资料（头像/昵称）
 * @param {object} data { avatar, nickname }
 */
export function updateUserProfile(data) {
  return put('/api/v1/user/profile', data)
}
