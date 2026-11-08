import Taro from '@tarojs/taro'
import { authStore } from '@/stores/auth.js'
import { joinUrl } from '@/utils/misc.js'

export const baseUrl = 'https://v2.mug.moegrid.com'

// 无需预检 Token 的白名单路径（防止递归死循环）
const NO_AUTH_PATHS = ['/user/login']

export async function ajax(method, url, data, isRetry = false) {
  const isNoAuth = NO_AUTH_PATHS.some((path) => url.includes(path))

  // 请求前守卫：如果不是登录接口且当前本地无 Token，自动触发静默登录
  if (!isNoAuth && !authStore.token) {
    try {
      await authStore.login()
    } catch (e) {
      return Promise.reject(new Error('未登录或登录失败'))
    }
  }

  return new Promise((resolve, reject) => {
    Taro.request({
      url: joinUrl(baseUrl, url),
      data,
      method,
      header: {
        Authorization: authStore.token ? `Bearer ${authStore.token}` : '',
      },
      success: async (res) => {
        if (res.statusCode === 200) {
          if (res.data.code > 0) {
            resolve(res.data.data)
          } else {
            reject(new Error(res.data.msg))
          }
        } else if (res.statusCode === 401) {
          // 如果当前是免登录白名单接口本身报 401，或者已经重试过一次了，不再死循环重试
          if (isNoAuth || isRetry) {
            authStore.clear()
            reject(new Error('登录凭证已失效，请重新进入小程序'))
            return
          }

          // 核心机制：本地 Token 过期失效时，自动触发强制静默重新登录并无感重发请求
          try {
            // 强制重新登录（共享同一个 loginPromise 锁，并发 401 仅发一次微信登录）
            await authStore.login(true)
            // 拿到崭新有效 Token 后，重新重放本次请求并返回给原调用方（业务层无感知）
            const retryRes = await ajax(method, url, data, true)
            resolve(retryRes)
          } catch (retryErr) {
            authStore.clear()
            reject(new Error('自动重新登录失败，请退出重试'))
          }
        } else {
          reject(new Error(`网络错误: ${res.statusCode}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

export async function upload(url, data, isRetry = false) {
  // 上传文件前确保已具备登录凭据
  if (!authStore.token) {
    try {
      await authStore.login()
    } catch (e) {
      return Promise.reject(new Error('未登录或登录失败'))
    }
  }

  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url: joinUrl(baseUrl, url),
      header: {
        Authorization: authStore.token ? `Bearer ${authStore.token}` : '',
      },
      success: async (res) => {
        if (res.statusCode === 200) {
          let body = res.data
          if (typeof body === 'string') {
            try {
              body = JSON.parse(body)
            } catch (e) {}
          }
          if (body && body.code > 0) {
            resolve(body.data)
          } else {
            reject(new Error(body ? body.msg : '上传失败'))
          }
        } else if (res.statusCode === 401) {
          if (isRetry) {
            authStore.clear()
            reject(new Error('登录凭证已失效，请重新进入小程序'))
            return
          }
          try {
            await authStore.login(true)
            const retryRes = await upload(url, data, true)
            resolve(retryRes)
          } catch (retryErr) {
            authStore.clear()
            reject(new Error('自动重新登录失败，请退出重试'))
          }
        } else {
          reject(new Error(`网络错误: ${res.statusCode}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '上传失败'))
      },
      ...data,
    })
  })
}

export function post(api, data) {
  return ajax('POST', api, data)
}

export function get(api, data) {
  return ajax('GET', api, data)
}

export function uploadUrl(url) {
  if (!url) return ''
  return joinUrl(baseUrl, '/storage/', url)
}
