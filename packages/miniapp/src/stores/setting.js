import Taro from '@tarojs/taro'

const STORAGE_KEY = 'app_settings'

class SettingStore {
  constructor() {
    this.state = {
      device: 0,
      mainMode: 'arcade', // 'arcade' (街机音游) | 'card' (卡牌通行证)
    }
    try {
      const str = Taro.getStorageSync(STORAGE_KEY)
      if (str) {
        this.state = { ...this.state, ...JSON.parse(str) }
      }
    } catch (e) {
      console.error('设置解析错误: ', e)
    }
  }

  save() {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(this.state))
  }

  setSelectedDeviceId(val) {
    this.state.device = val
    this.save()
  }

  setMainMode(mode) {
    this.state.mainMode = mode
    this.save()
  }
}

export const settingStore = new SettingStore()
