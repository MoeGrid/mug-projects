import Taro from '@tarojs/taro'
import { authStore } from '@/stores/auth.js'
import { joinUrl } from '@/utils/misc.js'

export const baseUrl = 'https://v2.mug.moegrid.com'
// export const baseUrl = 'http://192.168.31.100:3000'

// 无需预检 Token 的白名单路径（防止递归死循环）
const NO_AUTH_PATHS = ['/api/v1/auth/wechat-login']

/**
 * 核心请求客户端：支持自动 Token 注入、401 无感静默重登与并发锁重发
 */
export async function request(method, url, data, isRetry = false) {
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
      method: method.toUpperCase(),
      header: {
        Authorization: authStore.token ? `Bearer ${authStore.token}` : '',
        'Content-Type': 'application/json',
      },
      success: async (res) => {
        if (res.statusCode === 200) {
          if (res.data.code > 0) {
            resolve(res.data.data)
          } else {
            reject(new Error(res.data.msg || '业务处理失败'))
          }
        } else if (res.statusCode === 401) {
          if (isNoAuth || isRetry) {
            authStore.clear()
            reject(new Error('登录凭证已失效，请重新进入小程序'))
            return
          }

          // 本地 Token 过期失效时，自动触发强制静默重新登录并无感重发请求
          try {
            await authStore.login(true)
            const retryRes = await request(method, url, data, true)
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

export const get = (url, params) => request('GET', url, params)
export const post = (url, data) => request('POST', url, data)
export const put = (url, data) => request('PUT', url, data)
export const patch = (url, data) => request('PATCH', url, data)
export const del = (url, data) => request('DELETE', url, data)

/**
 * 上传文件客户端
 */
export async function upload(url, options, isRetry = false) {
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
      name: options.name || 'file',
      filePath: options.filePath,
      formData: options.formData || {},
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
            const retryRes = await upload(url, options, true)
            resolve(retryRes)
          } catch (retryErr) {
            authStore.clear()
            reject(new Error('自动重新登录失败，请退出重试'))
          }
        } else {
          reject(new Error(`上传错误: ${res.statusCode}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '文件上传失败'))
      },
    })
  })
}
