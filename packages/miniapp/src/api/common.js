import { upload, baseUrl } from './client'
import { joinUrl } from '@/utils/misc.js'

/**
 * 通用图片/头像上传
 * @param {string} filePath 本地临时文件路径
 */
export function uploadImage(filePath) {
  return upload('/api/v1/common/upload', {
    name: 'image',
    filePath,
  })
}

/**
 * 将文件相对路径拼接为完整可访问的静态资源 URL
 * @param {string} url 相对路径 (如 image/cd/xxx.jpeg)
 */
export function uploadUrl(url) {
  if (!url) return ''
  return joinUrl(baseUrl, '/storage/', url)
}
