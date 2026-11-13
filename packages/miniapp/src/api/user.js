import { get, put, del, upload } from './client'

/**
 * 获取当前用户资料
 */
export function getUserProfile() {
  return get('/api/v1/user/profile')
}

/**
 * 更新用户个人资料（头像/昵称）
 * @param {object} data { avatar, nickname }
 */
export function updateUserProfile(data) {
  return put('/api/v1/user/profile', data)
}

/**
 * 获取用户照片档案状态
 */
export function getUserPhotoStatus() {
  return get('/api/v1/user/face/status')
}

/**
 * 上传用户照片
 * @param {string} filePath 本地图片临时路径
 */
export function uploadUserPhoto(filePath) {
  return upload('/api/v1/user/face/register', {
    name: 'image',
    filePath,
  })
}

/**
 * 删除用户照片档案
 */
export function deleteUserPhoto() {
  return del('/api/v1/user/face')
}



