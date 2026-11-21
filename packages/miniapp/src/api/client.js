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
      timeout: 15000,
      header: {
        Authorization: authStore.token ? `Bearer ${authStore.token}` : '',
        'Content-Type': 'application/json',
      },
      success: async (res) => {
        try {
          if (res.statusCode === 200) {
            const body = res.data && typeof res.data === 'object' ? res.data : {}
            if (body.code > 0) {
              resolve(body.data)
            } else {
              const err = new Error(body.msg || '业务处理失败')
              err.status = res.statusCode
              err.code = body.code
              err.extra = body
              reject(err)
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
            // 非 200 也把服务端的提示透出来（二维码过期/无效这些比「网络错误: 410」有用）
            let body = res.data
            if (typeof body === 'string') {
              try {
                body = JSON.parse(body)
              } catch (e) {}
            }
            // 服务端的 401/403 是纯文本（HTTPException），这里要兼容，否则只会显示「网络错误: 403」
            const msg =
              (body && body.msg) ||
              (typeof body === 'string' ? body.slice(0, 100) : '') ||
              `网络错误: ${res.statusCode}`
            const err = new Error(msg)
            err.status = res.statusCode
            reject(err)
          }
        } catch (err) {
          // success 回调里的异常必须显式 reject，否则 Promise 永远 pending，loading 蒙层也关不掉
          reject(err)
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
      timeout: 60000,
      header: {
        Authorization: authStore.token ? `Bearer ${authStore.token}` : '',
      },
      name: options.name || 'file',
      filePath: options.filePath,
      formData: options.formData || {},
      success: async (res) => {
        try {
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
              const err = new Error(body ? body.msg : '上传失败')
              err.status = res.statusCode
              err.extra = body
              reject(err)
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
        } catch (err) {
          reject(err)
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '文件上传失败'))
      },
    })
  })
}
