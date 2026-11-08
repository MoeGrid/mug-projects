// 通用能力模块（Common）
import {Hono} from 'hono';
import {userAuth} from '../../utils/middleware.js';
import {AppError, ok} from '../../utils/responses.js';
import {putFile} from '../../utils/storage.js';
import type {Env} from '../../app.js';

export const commonRouter = new Hono<Env>();

commonRouter.use('*', userAuth);

/**
 * POST /api/v1/common/upload
 * 通用文件上传（支持头像、凭证等，临时存储在 tmp/，由后续业务转存）
 */
commonRouter.post('/upload', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new AppError('解析上传表单失败');
  }

  const file = form.get('image') ?? form.get('file');
  if (!file || !(file instanceof File)) {
    throw new AppError('请选择要上传的文件');
  }

  // 大小限制 2MB
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
