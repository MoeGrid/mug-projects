// 身份认证模块（Auth）
import {Hono} from 'hono';
import {z} from 'zod';
import {db} from '../../db/client.js';
import * as WeSdk from '../../services/wechat.js';
import {generateToken} from '../../utils/auth.js';
import {body} from '../../utils/validator.js';
import {AppError, ok} from '../../utils/responses.js';
import {getSetting} from '../../models/event.js';
import {findUser, findUserByOpenId, insertUser, toPublic, updateUser} from '../../models/user.js';
import type {Env} from '../../app.js';

export const authRouter = new Hono<Env>();

/**
 * POST /api/v1/auth/wechat-login
 * 微信静默登录：通过微信临时 code 换取 openid，自动注册/登录，签发 JWT Token
 */
authRouter.post('/wechat-login', async (c) => {
  const { code } = await body(c, z.object({
    code: z.string('code不能为空').min(1, 'code不能为空').max(255, 'code过长'),
  }));

  // 请求微信服务器换取 openid
  const res = await WeSdk.authCode2Session(code);

  // 保存登录 / 自动注册
  let user = await findUserByOpenId(db, res.openid);
  if (!user) {
    const id = await insertUser(db, {
      open_id: res.openid,
      session_key: res.session_key,
      nickname: '微信用户',
      is_admin: 0,
      is_ban: 0,
      balance: 0,
      expire_date: '1970-01-01',
    });
    user = await findUser(db, id);
  } else {
    await updateUser(db, user.id, {session_key: res.session_key});
  }

  if (!user) throw new AppError('用户注册或创建失败');

  const data = toPublic(user) as Record<string, unknown>;
  data.token = await generateToken(user.id);

  // 封禁提示
  if (user.is_ban) {
    data.ban_msg = await getSetting('user_lock_msg', '账号已被封禁！');
  }

  return c.json(ok(data));
});
