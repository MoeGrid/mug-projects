import { get, patch, post } from './client'

/**
 * 获取财务收支概览（今日/当月充值、今日/当月消费、在场TCG人数）
 */
export function adminGetFinanceSummary() {
  return get('/api/v1/admin/finance/summary')
}

/**
 * 分页获取充值明细
 * @param {object} params { page, rows }
 */
export function adminGetRecharges(params) {
  return get('/api/v1/admin/finance/recharges', params)
}

/**
 * 分页获取消费明细
 * @param {object} params { page, rows }
 */
export function adminGetConsumptions(params) {
  return get('/api/v1/admin/finance/consumptions', params)
}

/**
 * 获取当前在场有效 TCG 畅玩记录（用于无人值守监控抽查）
 */
export function adminGetTcgActiveSessions() {
  return get('/api/v1/admin/tcg/active-sessions')
}

/**
 * 分页搜索用户
 * @param {object} params { keyword, page, rows }
 */
export function adminSearchUsers(params) {
  return get('/api/v1/admin/users', params)
}

/**
 * 获取指定用户详情
 * @param {number} id 用户UID
 */
export function adminGetUserDetail(id) {
  return get(`/api/v1/admin/users/${id}`)
}

/**
 * 修改用户属性（管理员/封禁/备注/手机/QQ）
 * @param {object} user { id, is_admin, is_ban, phone, qq, remark }
 */
export function adminUpdateUser(user) {
  const { id, ...data } = user
  return patch(`/api/v1/admin/users/${id}`, data)
}

/**
 * 管理员调配用户资产（余额加减/MUG天数加减/TCG天数加减）
 * @param {object} data { id, type, num }
 * type: 1余额, 2音游MUG天数, 3卡牌TCG月卡天数
 * num: 正数为加，负数为减
 */
export function adminAdjustBalance(data) {
  const { id, type, num } = data
  return post(`/api/v1/admin/users/${id}/adjust-balance`, { type, num })
}

