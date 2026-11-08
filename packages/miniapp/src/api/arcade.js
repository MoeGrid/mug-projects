import { get, post } from './client'

/**
 * 获取音游街机机台分组与设备列表
 */
export function getArcadeDevices() {
  return get('/api/v1/arcade/devices')
}

/**
 * 远程 MQTT 脉冲投币
 * @param {number} deviceId 设备ID
 */
export function remoteInsertCoin(deviceId) {
  return post('/api/v1/arcade/coins/remote-insert', { deviceId })
}

/**
 * BLE 蓝牙投币上报结算
 * @param {number} deviceId 设备ID
 */
export function bleConsumeCoin(deviceId) {
  return post('/api/v1/arcade/coins/ble-consume', { deviceId })
}

/**
 * 分页获取街机投币记录（支持畅玩免扣与余额投币）
 * @param {{ page?: number, rows?: number }} params
 */
export function getCoinLogs(params) {
  return get('/api/v1/arcade/coins/logs', params)
}
