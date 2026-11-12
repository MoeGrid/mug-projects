// 人脸识别微服务（InsightFace Server）交互
import { config } from '../config.js';
import { AppError } from '../utils/responses.js';

export function toPersonId(userId) {
  return String(userId);
}

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${config.face.apiKey}`,
    Accept: 'application/json',
  };
}

/**
 * 查询指定用户的人脸注册状态
 * @param {number|string} userId 用户UID
 * @returns {Promise<{ registered: boolean, face_count: number, updated_at?: string }>}
 */
export async function getFaceStatus(userId) {
  const personId = toPersonId(userId);
  const baseUrl = config.face.host.replace(/\/+$/, '');
  const url = `${baseUrl}/v1/collections/${config.face.collection}/persons/${personId}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (res.status === 200) {
      const data = await res.json();
      const faceCount = data.person?.face_count ?? 0;
      return {
        registered: faceCount > 0,
        face_count: faceCount,
        updated_at: data.person?.updated_at || null,
      };
    }

    if (res.status === 404) {
      return { registered: false, face_count: 0, updated_at: null };
    }

    throw new Error(`人脸服务响应异常: ${res.status}`);
  } catch (err) {
    console.error(`查询人脸状态失败 [UID: ${userId}]:`, err.message);
    throw new AppError('查询人脸状态失败，请稍后重试');
  }
}

/**
 * 注册 / 更新用户人脸照片
 * @param {number|string} userId 用户UID
 * @param {string} nickname 用户昵称
 * @param {Buffer} imageBuffer 图片二进制Buffer
 * @param {string} filename 文件名
 */
export async function registerFace(userId, nickname, imageBuffer, filename = 'face.jpg') {
  const personId = toPersonId(userId);
  const baseUrl = config.face.host.replace(/\/+$/, '');

  // 1. 若已存在旧档案，先删除旧档案保证唯一覆盖
  try {
    const deleteUrl = `${baseUrl}/v1/collections/${config.face.collection}/persons/${personId}`;
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  } catch (e) {
    // 忽略删除失败
  }

  // 2. 构造并上传新的人脸档案
  const createUrl = `${baseUrl}/v1/collections/${config.face.collection}/persons`;
  const form = new FormData();
  form.append('id', personId);
  form.append('name', nickname || personId);

  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  form.append('images', blob, filename);

  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.face.apiKey}`,
      Accept: 'application/json',
    },
    body: form,
  });

  const resData = await res.json().catch(() => null);

  if (res.status === 200 || res.status === 201) {
    return {
      registered: true,
      message: '人脸录入成功',
      person_id: personId,
    };
  }

  // 3. 处理失败原因并转换为易懂中文提示
  const reason = resData?.error?.details?.rejected_images?.[0]?.reason;
  if (reason === 'no_face' || reason === 'no_faces') {
    throw new AppError('未在照片中检测到人脸，请保持光线明亮正对镜头');
  }
  if (reason === 'multiple_faces') {
    throw new AppError('照片中检测到多张人脸，请确保画面中仅有您一人');
  }
  if (reason === 'low_quality' || reason === 'blurry') {
    throw new AppError('人脸不够清晰，请重新拍摄正面照');
  }
  if (reason === 'invalid_image') {
    throw new AppError('图片格式不正确，请重新拍照上传');
  }

  const errMessage = resData?.error?.message || '人脸检测失败，请重试';
  throw new AppError(errMessage);
}

/**
 * 注销 / 删除用户人脸档案
 * @param {number|string} userId 用户UID
 */
export async function deleteFace(userId) {
  const personId = toPersonId(userId);
  const baseUrl = config.face.host.replace(/\/+$/, '');
  const url = `${baseUrl}/v1/collections/${config.face.collection}/persons/${personId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (res.status === 200 || res.status === 204 || res.status === 404) {
    return { registered: false, message: '人脸档案已注销' };
  }

  throw new AppError('注销人脸失败，请重试');
}

/**
 * 人脸特征比对与搜索 (1:N 检索)
 * @param {Buffer} imageBuffer 图片二进制Buffer
 * @param {string} filename 文件名
 * @param {object} options 搜索参数选项 (limit, threshold 等)
 * @returns {Promise<{ person_id: string, similarity: number, person: object } | null>}
 */
export async function searchFace(imageBuffer, filename = 'face.jpg', options = {}) {
  const baseUrl = config.face.host.replace(/\/+$/, '');
  const searchUrl = `${baseUrl}/v1/collections/${config.face.collection}/search`;

  const form = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  form.append('image', blob, filename);
  if (options.limit) {
    form.append('limit', String(options.limit));
  }
  if (options.threshold !== undefined && options.threshold !== null) {
    form.append('threshold', String(options.threshold));
  }

  const res = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.face.apiKey}`,
      Accept: 'application/json',
    },
    body: form,
  });

  const resData = await res.json().catch(() => null);

  if (res.status === 200) {
    const matches = resData?.matches || [];
    if (!matches.length) {
      return null;
    }
    const best = matches[0];
    return {
      person_id: best.person?.id,
      similarity: best.similarity,
      person: best.person,
    };
  }

  // 处理失败原因 (如无人脸、多张脸、假脸攻击等)
  const reason = resData?.error?.details?.rejected_images?.[0]?.reason || resData?.error?.details?.liveness?.reason;
  if (reason === 'no_face' || reason === 'no_faces') {
    throw new AppError('未在照片中检测到有效人脸，请正对摄像头重试');
  }
  if (reason === 'multiple_faces') {
    throw new AppError('画面中检测到多张人脸，请保持单人正对镜头');
  }
  if (reason === 'low_quality' || reason === 'blurry') {
    throw new AppError('人脸图像不够清晰，请重新拍摄');
  }
  if (reason === 'liveness_fake') {
    throw new AppError('活体检测未通过，请使用真人正对镜头');
  }
  if (res.status === 404) {
    throw new AppError('人脸识别集合未初始化');
  }

  const errMessage = resData?.error?.message || '人脸特征比对失败，请重试';
  throw new AppError(errMessage);
}
