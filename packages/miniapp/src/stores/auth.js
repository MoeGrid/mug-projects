import Taro from '@tarojs/taro'
import { login as apiLogin, available as apiAvailable } from '@/api'

class AuthStore {
  constructor() {
    this.token = ''
    this.user = null
    this.available = {
      balance: 0,
      arcade_days: 0,
      tcg_days: 0,
      days: 0,
    }
    this.listeners = new Set()
    this.loginPromise = null

    // 清理历史残留的本地 Storage，确保每次打开小程序都向服务端获取最新用户状态与封禁状态
    try {
      Taro.removeStorageSync('mug_auth_token')
      Taro.removeStorageSync('mug_auth_user')
    } catch (e) {}
  }

  notify() {
    const payload = {
      token: this.token,
      user: this.user,
      available: this.available,
    }
    this.listeners.forEach((listener) => {
      try {
        listener(payload)
      } catch (err) {
        console.error('authStore listener error:', err)
      }
    })
  }

  subscribe(listener) {
    this.listeners.add(listener)
    // 立即执行一次传递当前内存快照
    try {
      listener({
        token: this.token,
        user: this.user,
        available: this.available,
      })
    } catch (err) {
      console.error('authStore immediate listener error:', err)
    }
    return () => this.listeners.delete(listener)
  }

  setToken(t) {
    this.token = t || ''
    this.notify()
  }

  setUser(u) {
    this.user = u || null
    this.notify()
  }

  setAvailable(a) {
    const raw = a || {}
    const arcadeDays = raw.arcade_days ?? raw.days ?? 0
    const tcgDays = raw.tcg_days ?? 0
    this.available = {
      balance: raw.balance || 0,
      arcade_days: arcadeDays,
      tcg_days: tcgDays,
      days: arcadeDays,
    }
    this.notify()
  }

  clear() {
    this.token = ''
    this.user = null
    this.available = { balance: 0, arcade_days: 0, tcg_days: 0, days: 0 }
    this.notify()
  }

  async login(force = false) {
    // 1. 在当前小程序会话内（未关闭），若内存中已有有效 token 和 user，直接复用
    if (!force && this.token && this.user) {
      return this.user
    }

    // 2. 防并发竞态：如果有正在进行的登录请求，直接复用 Promise
    if (this.loginPromise) {
      return this.loginPromise
    }

    this.loginPromise = (async () => {
      try {
        const { code } = await Taro.login()
        const res = await apiLogin(code)
        this.setToken(res.token)
        this.setUser(res)
        return res
      } catch (e) {
        throw e
      } finally {
        this.loginPromise = null
      }
    })()

    return this.loginPromise
  }

  async refreshAvailable() {
    const res = await apiAvailable()
    this.setAvailable(res)
    return res
  }
}

export const authStore = new AuthStore()
