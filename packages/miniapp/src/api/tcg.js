import { get } from './client'

/**
 * 获取 TCG 卡牌通行证套餐配置
 */
export function getTcgPassOptions() {
  return get('/api/v1/tcg/passes/options')
}

/**
 * 获取 TCG 卡牌赛事与活动
 */
export function getTcgEvents() {
  return get('/api/v1/tcg/events')
}
