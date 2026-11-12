// 认证领域路由
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client.js';
import * as WeSdk from '../../services/wechat.js';
import { searchFace } from '../../services/face.js';
import { generateToken } from '../../utils/auth.js';
import { body } from '../../utils/validator.js';
import { AppError, ok } from '../../utils/responses.js';
import { getSetting } from '../../models/event.js';
import { findUser, findUserByOpenId, insertUser, toPublic, updateUser } from '../../models/user.js';

export const authRouter = new Hono();

/**
 * POST /api/v1/auth/wechat-login
 * 微信静默登录
 */
authRouter.post('/wechat-login', async (c) => {
  const { code } = await body(
    c,
    z.object({
      code: z.string('code不能为空').min(1, 'code不能为空').max(255, 'code过长'),
    })
  );

  const res = await WeSdk.authCode2Session(code);

  let user = await findUserByOpenId(db, res.openid);
  if (!user) {
    const id = await insertUser(db, {
      open_id: res.openid,
      session_key: res.session_key,
      nickname: '微信用户',
      is_admin: 0,
      is_ban: 0,
      balance: 0,
      arcade_expire_date: null,
      tcg_expire_date: null,
    });
    user = await findUser(db, id);
  } else {
    await updateUser(db, user.id, { session_key: res.session_key });
  }

  if (!user) throw new AppError('用户注册或创建失败');

  const data = toPublic(user);
  data.token = await generateToken(user.id);

  if (user.is_ban) {
    data.ban_msg = await getSetting('user_lock_msg', '账号已被封禁！');
  }

  return c.json(ok(data));
});

/**
 * POST /api/v1/auth/face-login
 * 人脸识别登录 (供安卓 Kiosk 终端使用)
 * 接受 multipart/form-data (字段名为 image 或 file) 或 application/json (字段名为 image 的 Base64)
 */
authRouter.post('/face-login', async (c) => {
  let imageBuffer = null;
  let filename = 'face.jpg';

  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await c.req.json().catch(() => ({}));
    const rawImage = json.image || json.file || json.base64;
    if (!rawImage || typeof rawImage !== 'string') {
      throw new AppError('请提供人脸图片 Base64 数据 (字段: image)');
    }
    const base64Data = rawImage.replace(/^data:image\/\w+;base64,/, '');
    imageBuffer = Buffer.from(base64Data, 'base64');
  } else {
    let form;
    try {
      form = await c.req.formData();
    } catch {
      throw new AppError('解析上传表单失败');
    }

    const file = form.get('image') ?? form.get('file');
    if (!file || !(file instanceof File)) {
      throw new AppError('请上传人脸照片文件 (表单字段: image 或 file)');
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new AppError('照片文件大小不能超过 8MB');
    }

    filename = file.name || 'face.jpg';
    imageBuffer = Buffer.from(await file.arrayBuffer());
  }

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new AppError('上传的人脸照片数据为空');
  }

  // 1. 调用 InsightFace 服务的 1:N 检索接口
  const searchResult = await searchFace(imageBuffer, filename);
  if (!searchResult || !searchResult.person_id) {
    throw new AppError('未在底库中查询到匹配的人脸档案，请先在小程序中完成人脸录入', 404, {
      error_type: 'UNREGISTERED',
      title: '未录入人脸档案',
      need_register: true,
    });
  }

  // 2. 根据 person_id 匹配系统真实用户
  const userId = parseInt(searchResult.person_id, 10);
  if (!userId || Number.isNaN(userId)) {
    throw new AppError('识别出无效的人员ID', 400, {
      error_type: 'SYSTEM_ERROR',
      title: '核验异常',
      need_register: false,
    });
  }

  const user = await findUser(db, userId);
  if (!user) {
    throw new AppError('人脸对应用户档案不存在或已被注销', 404, {
      error_type: 'UNREGISTERED',
      title: '未录入人脸档案',
      need_register: true,
    });
  }

  // 3. 构造公开资料并签发通用 JWT Token
  const data = toPublic(user);
  data.token = await generateToken(user.id);
  data.similarity = searchResult.similarity;

  if (user.is_ban) {
    data.ban_msg = await getSetting('user_lock_msg', '账号已被封禁！');
  }

  return c.json(ok(data));
});
