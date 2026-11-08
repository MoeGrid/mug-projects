import Taro from '@tarojs/taro'

const SERVICE_UUID = 'e8154f0a-7291-43a4-a39d-a31a77e073a1'
const CHARACTERISTIC_UUID = 'ebb8ac7e-7536-4836-bf47-30cc6fff764d'

export class BLEError extends Error {}

class CoinSdk {
  isOpen = false // 是否已打开
  isScan = false // 是否扫描中
  isConnected = false // 是否连接
  devices = {} // 扫描到的设备列表
  target = null // 目标设备
  service = null // 服务
  characteristics = null // 服务特征值

  constructor() {
    Taro.onBluetoothDeviceFound((devices) => {
      devices.devices.forEach((el) => {
        console.debug('[DEBUG] 发现蓝牙设备: ', el)
        if (el.localName) {
          this.devices[el.localName] = el
        }
      })
    })
  }

  // ******************** 公开函数 ********************

  async auth() {
    const { authSetting } = await Taro.getSetting()
    if (!authSetting['scope.bluetooth']) {
      await Taro.authorize({
        scope: 'scope.bluetooth',
      })
    }
  }

  async init() {
    await this._open()
    console.info('>>> SDK初始化成功')
  }

  async destroy() {
    if (this.isScan)
      await this._stopScan()
    if (this.isConnected)
      await this._disconnect()
    if (this.isOpen)
      await this._close()
    console.info('>>> SDK销毁成功')
  }

  async connect(deviceName, timeout) {
    await this._startScan()
    await this._waitDevice(deviceName, timeout)
    await this._stopScan()
    await this._connect()
    await this._getServices()
    await this._getCharacteristic()
    console.info('>>> 设备连接成功')
  }

  async coins(num) {
    await this._write(Uint8Array.from([0xA2, num]).buffer)
    console.info('>>> 投币成功')
  }

  // ******************** 私有函数 ********************

  async _open() {
    await Taro.openBluetoothAdapter()
    this.isOpen = true
    console.debug('[DEBUG] 蓝牙开启成功')
  }

  async _close() {
    await Taro.closeBluetoothAdapter()
    this.isOpen = false
    console.debug('[DEBUG] 蓝牙关闭成功')
  }

  async _startScan() {
    this.devices = {}
    await Taro.startBluetoothDevicesDiscovery({
      services: [SERVICE_UUID],
    })
    this.isScan = true
    console.debug('[DEBUG] 开启蓝牙扫描成功')
  }

  async _stopScan() {
    await Taro.stopBluetoothDevicesDiscovery()
    this.isScan = false
    console.debug('[DEBUG] 停止蓝牙扫描成功')
  }

  _waitDevice(id, timeout) {
    return new Promise((resolve, reject) => {
      let num = 0
      const timer = setInterval(() => {
        num++
        if (timeout && num / 2 > timeout) {
          clearInterval(timer)
          reject(new BLEError('findBluetoothDevice:fail 寻找蓝牙设备超时'))
        }
        else if (Object.prototype.hasOwnProperty.call(this.devices, id)) {
          clearInterval(timer)
          this.target = this.devices[id]
          console.debug('[DEBUG] 找到目标设备', this.target)
          resolve()
        }
      }, 500)
    })
  }

  async _connect() {
    await Taro.createBLEConnection({
      deviceId: this.target.deviceId,
      timeout: 5000,
    })
    this.isConnected = true
    console.debug('[DEBUG] 蓝牙连接成功')
  }

  async _disconnect() {
    await Taro.closeBLEConnection({
      deviceId: this.target.deviceId,
    })
    this.isConnected = false
    console.debug('[DEBUG] 蓝牙断开成功')
  }

  async _getServices() {
    const { services } = await Taro.getBLEDeviceServices({
      deviceId: this.target.deviceId,
    })
    for (const i of services) {
      if (i.uuid.toLowerCase() === SERVICE_UUID) {
        this.service = i
        console.debug('[DEBUG] 蓝牙获取服务成功', this.service)
        return
      }
    }
    throw new BLEError('找不到服务')
  }

  async _getCharacteristic() {
    const { characteristics } = await Taro.getBLEDeviceCharacteristics({
      deviceId: this.target.deviceId,
      serviceId: this.service.uuid,
    })
    for (const i of characteristics) {
      if (i.uuid.toLowerCase() === CHARACTERISTIC_UUID) {
        this.characteristics = i
        console.debug('[DEBUG] 蓝牙获取服务特征值成功', this.characteristics)
        return
      }
    }
    throw new BLEError('找不到特征')
  }

  _write(data) {
    return Taro.writeBLECharacteristicValue({
      deviceId: this.target.deviceId,
      serviceId: this.service.uuid,
      characteristicId: this.characteristics.uuid,
      value: data,
    }).then(() => {
      console.debug('[DEBUG] 蓝牙发送数据成功', data)
    })
  }
}

export const coinSdk = new CoinSdk()
