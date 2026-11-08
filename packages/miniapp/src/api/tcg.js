import { get, post } from './client'

/**
 * 获取 TCG 卡牌通行证套餐配置
 */
export function getTcgPassOptions() {
  return get('/api/v1/tcg/passes/options')
}

/**
 * 充值开通/续期 TCG 通行证天数（余额扣款）
 * @param {'day' | 'monthly'} planId
 */
export function rechargeTcgPass(planId) {
  return post('/api/v1/tcg/passes/recharge', { planId })
}

/**
 * 获取 TCG 卡牌赛事与活动
 */
export function getTcgEvents() {
  return get('/api/v1/tcg/events')
}
