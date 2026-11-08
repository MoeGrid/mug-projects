// 用户模块（User）
import {Hono} from 'hono';
import {z} from 'zod';
import {db} from '../../db/client.js';
import {userAuth} from '../../utils/middleware.js';
import {body} from '../../utils/validator.js';
import {AppError, ok} from '../../utils/responses.js';
import {fileExists, moveTmpToImage} from '../../utils/storage.js';
import {findUser, toPublic, updateUser} from '../../models/user.js';
import type {Env} from '../../app.js';

export const userRouter = new Hono<Env>();

userRouter.use('*', userAuth);

const currentUser = (c: { get: (k: 'user') => any }) => c.get('user');

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
  const { avatar: rawAvatar, nickname } = await body(c, z.object({
    avatar: z.string('头像不能为空').min(1, '头像不能为空').max(255, '头像过长'),
    nickname: z.string('昵称不能为空').min(1, '昵称不能为空').max(255, '昵称过长'),
  }));

  const user = currentUser(c);
  let avatar = rawAvatar;

  // 如果上传的是临时文件 tmp，转存到正规 image 目录
  if (avatar.startsWith('tmp')) {
    if (!(await fileExists(avatar))) throw new AppError('头像文件不存在');
    avatar = await moveTmpToImage(avatar);
  }

  await updateUser(db, user.id, { nickname, avatar });
  const updatedUser = await findUser(db, user.id);

  return c.json(ok(toPublic(updatedUser ?? user)));
});
