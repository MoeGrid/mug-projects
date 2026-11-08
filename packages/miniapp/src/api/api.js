import { post, upload, uploadUrl } from './index'

export { uploadUrl }

/**
 * 微信静默登录
 * @param {string} code 微信临时登录凭证
 */
export function login(code) {
  return post('/user/login', { code })
}

/**
 * 更新玩家个人资料（头像/昵称）
 * @param {object} data { avatar, nickname }
 */
export function profile(data) {
  return post('/user/profile', data)
}

/**
 * 获取用户当前可用余额与有效天数
 */
export function available() {
  return post('/user/available')
}

/**
 * 获取机台及设备分组列表
 */
export function fetchDeviceList() {
  return post('/device/list1')
}

export const deviceList = fetchDeviceList

/**
 * BLE 蓝牙投币扣款
 * @param {number} id 设备ID
 */
export function useBalance(id) {
  return post('/user/use', { id })
}

/**
 * MQTT 远程投币扣款
 * @param {number} id 设备ID
 */
export function useBalance2(id) {
  return post('/user/use2', { id })
}

/**
 * 购买普通充值
 * @param {number} number 充值金额（整数）
 */
export function buyRecharge(number) {
  return post('/buy/recharge', { number })
}

/**
 * 购买特惠活动套餐
 * @param {number} id 活动ID
 */
export function buyEvent(id) {
  return post('/buy/event', { id })
}

/**
 * 查询投币/充值余额变动明细记录
 * @param {object} data { page, rows }
 */
export function balanceLogList(data) {
  return post('/balanceLog/list', data)
}

/**
 * 上传头像/文件
 * @param {string} file 本地临时文件路径
 */
export function uploadImage(file) {
  return upload('/upload/image', {
    name: 'image',
    filePath: file,
  })
}

/**
 * 获取当前特惠活动列表
 * @return {Promise<Array<any>>}
 */
export function eventList() {
  return post('/event/list')
}

/**
 * 管理后台：获取指定用户详情
 * @param {number} id 用户UID
 */
export function adminUserInfo(id) {
  return post('/admin/user/info', { id })
}

/**
 * 管理后台：搜索/分页查询用户
 * @param {object} data { keyword, page, rows }
 */
export function adminSearchUser(data) {
  return post('/admin/user/search', data)
}

/**
 * 管理后台：修改用户资料（管理员/封禁/QQ/手机/备注）
 * @param {object} user 用户对象
 */
export function adminModifyUser(user) {
  return post('/admin/user/modify', user)
}

/**
 * 管理后台：管理员调配充值（余额/天数）
 * @param {object} data { id, type, num }
 */
export function adminRechange(data) {
  return post('/admin/user/rechange', data)
}
