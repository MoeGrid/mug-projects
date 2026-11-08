import { get, post } from './client'

/**
 * 获取当前钱包资产（余额、音游通行证天数、TCG通行证天数）
 */
export function getWalletAssets() {
  return get('/api/v1/wallet/assets')
}

export const available = getWalletAssets

/**
 * 获取充值特惠套餐活动列表
 */
export function getRechargePackages() {
  return get('/api/v1/wallet/packages')
}

export const eventList = getRechargePackages

/**
 * 自定义金额充值下单
 * @param {number} amount 充值金额
 */
export function createRechargeOrder(amount) {
  return post('/api/v1/wallet/orders/recharge', { amount: Number(amount) })
}

export const buyRecharge = (number) => createRechargeOrder(number)

/**
 * 购买特惠活动套餐
 * @param {number} packageId 套餐ID
 */
export function createPackageOrder(packageId) {
  return post('/api/v1/wallet/orders/package', { packageId: Number(packageId) })
}

export const buyEvent = (id) => createPackageOrder(id)

/**
 * 查询投币/充值余额变动流水明细
 * @param {object} params { page, rows }
 */
export function getTransactionLogs(params) {
  return get('/api/v1/wallet/transactions', params)
}

export const balanceLogList = getTransactionLogs
