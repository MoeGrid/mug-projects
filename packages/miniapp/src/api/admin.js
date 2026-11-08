import { get, patch, post } from './client'

/**
 * 分页搜索用户
 * @param {object} params { keyword, page, rows }
 */
export function adminSearchUsers(params) {
  return get('/api/v1/admin/users', params)
}

export const adminSearchUser = adminSearchUsers

/**
 * 获取指定用户详情
 * @param {number} id 用户UID
 */
export function adminGetUserDetail(id) {
  return get(`/api/v1/admin/users/${id}`)
}

export const adminUserInfo = (id) => adminGetUserDetail(id)

/**
 * 修改用户属性（管理员/封禁/备注/手机/QQ）
 * @param {object} user { id, is_admin, is_ban, phone, qq, remark }
 */
export function adminUpdateUser(user) {
  const { id, ...data } = user
  return patch(`/api/v1/admin/users/${id}`, data)
}

export const adminModifyUser = adminUpdateUser

/**
 * 管理员调配充值（加减余额/有效天数，彻底修复历史拼写错误）
 * @param {object} data { id, type, num }
 */
export function adminAdjustBalance(data) {
  const { id, type, num } = data
  return post(`/api/v1/admin/users/${id}/adjust-balance`, { type, num })
}

export const adminRechange = adminAdjustBalance
