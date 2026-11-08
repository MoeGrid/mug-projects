// 通用能力领域路由
import { Hono } from 'hono';
import { userAuth } from '../../utils/middleware.js';
import { AppError, ok } from '../../utils/responses.js';
import { putFile } from '../../utils/storage.js';

export const commonRouter = new Hono();

commonRouter.use('*', userAuth);

/**
 * POST /api/v1/common/upload
 * 通用图片上传（支持头像等，暂存 tmp/ 目录）
 */
commonRouter.post('/upload', async (c) => {
  let form;
  try {
    form = await c.req.formData();
  } catch {
    throw new AppError('解析上传表单失败');
  }

  const file = form.get('image') ?? form.get('file');
  if (!file || !(file instanceof File)) {
    throw new AppError('请选择要上传的文件');
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new AppError('上传文件大小不能超过 2MB');
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if (!allowed.includes(ext)) {
    throw new AppError('不支持的文件类型');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const relPath = await putFile('tmp', buffer, ext);

  return c.json(ok(relPath));
});
