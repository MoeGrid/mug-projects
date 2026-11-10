import { get, post } from './client'

/**
 * 获取 TCG 卡牌通行证配置与状态
 */
export function getTcgPassOptions() {
  return get('/api/v1/tcg/passes/options')
}

/**
 * 开启今日畅玩（扣除单日余额，次日早 06:00 自动到期；月卡或今日已开启则免扣费）
 */
export function activateTcgPass() {
  return post('/api/v1/tcg/passes/activate')
}

/**
 * 开通 / 续费 TCG 畅玩月卡（未来 30 天每日畅玩免扣费）
 */
export function buyTcgMonthlyPass() {
  return post('/api/v1/tcg/passes/buy-monthly')
}

/**
 * 获取 TCG 卡牌赛事与活动
 */
export function getTcgEvents() {
  return get('/api/v1/tcg/events')
}
