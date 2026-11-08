// 微信开放接口服务
import axios from 'axios';
import { config } from '../config.js';
import { AppError } from '../utils/responses.js';

const http = axios.create({
  baseURL: 'https://api.weixin.qq.com',
  timeout: 10000,
});

async function callApi(url, params) {
  const { data } = await http.get(url, { params });
  if (data && typeof data === 'object' && 'errcode' in data && data.errcode !== 0) {
    throw new AppError(data.errmsg || '微信接口请求失败');
  }
  return data;
}

/** 微信 code2Session 换取 openid / session_key */
export async function authCode2Session(code) {
  return callApi('/sns/jscode2session', {
    appid: config.wechat.appId,
    secret: config.wechat.appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  });
}
