// 用户领域路由
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { userAuth } from '../../utils/middleware.js';
import { body } from '../../utils/validator.js';
import { AppError, ok } from '../../utils/responses.js';
import { fileExists, moveTmpToImage } from '../../utils/storage.js';
import { findUser, toPublic, updateUser } from '../../models/user.js';
import { getFaceStatus, registerFace, deleteFace } from '../../services/face.js';

export const userRouter = new Hono();

userRouter.use('*', userAuth);

const currentUser = (c) => c.get('user');

/**
 * GET /api/v1/user/profile
 * 获取当前登录用户资料
 */
userRouter.get('/profile', (c) => {
  return c.json(ok(toPublic(currentUser(c))));
});

/**
 * PUT /api/v1/user/profile
 * 修改当前登录用户资料（昵称、头像）
 */
userRouter.put('/profile', async (c) => {
  const { avatar: rawAvatar, nickname } = await body(
    c,
    z.object({
      avatar: z.string('头像不能为空').min(1, '头像不能为空').max(255, '头像过长'),
      nickname: z.string('昵称不能为空').min(1, '昵称不能为空').max(255, '昵称过长'),
    })
  );

  const user = currentUser(c);
  let avatar = rawAvatar;

  if (avatar.startsWith('tmp')) {
    if (!(await fileExists(avatar))) throw new AppError('头像文件不存在');
    avatar = await moveTmpToImage(avatar);
  }

  await updateUser(db, user.id, { nickname, avatar });
  const updatedUser = await findUser(db, user.id);

  return c.json(ok(toPublic(updatedUser ?? user)));
});

/**
 * GET /api/v1/user/face/status
 * 查询当前用户人脸注册状态
 */
userRouter.get('/face/status', async (c) => {
  const user = currentUser(c);
  const status = await getFaceStatus(user.id);
  return c.json(ok(status));
});

/**
 * POST /api/v1/user/face/register
 * 上传并注册/更新人脸照片
 */
userRouter.post('/face/register', async (c) => {
  const user = currentUser(c);

  let form;
  try {
    form = await c.req.formData();
  } catch {
    throw new AppError('解析上传表单失败');
  }

  const file = form.get('image') ?? form.get('file');
  if (!file || !(file instanceof File)) {
    throw new AppError('请选择拍摄的人脸照片');
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new AppError('照片文件不能超过 8MB');
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];
  if (!allowed.includes(ext)) {
    throw new AppError('请上传格式正确的图片（支持 JPG/PNG/WebP）');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await registerFace(user.id, user.nickname, buffer, file.name);

  return c.json(ok(result));
});

/**
 * DELETE /api/v1/user/face
 * 注销当前用户的人脸档案
 */
userRouter.delete('/face', async (c) => {
  const user = currentUser(c);
  const result = await deleteFace(user.id);
  return c.json(ok(result));
});

