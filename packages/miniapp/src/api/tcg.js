import { get, post } from './client'

/**
 * 获取 TCG 专区配置与状态（包含今日入场与 TCG PASS 状态）
 */
export function getTcgPassOptions() {
  return get('/api/v1/tcg/passes/options')
}

/**
 * TCG 进店入场
 */
export function tcgEntry() {
  return post('/api/v1/tcg/entry')
}

/**
 * 办理 / 续费 30 天 TCG PASS
 */
export function buyTcgPass() {
  return post('/api/v1/tcg/passes/buy')
}

/**
 * 获取 TCG 卡牌赛事与活动
 */
export function getTcgEvents() {
  return get('/api/v1/tcg/events')
}



