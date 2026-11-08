// 微信小程序登录 SDK（对应 app/facade/WeSdkFacade.php）
import crypto from 'node:crypto';
import {config} from '../config.js';
import {AppError} from '../utils/responses.js';

const BASE = 'https://api.weixin.qq.com';

// access_token 进程内缓存：单实例部署 + 常驻进程，直接持内存变量即可，无需 Redis 跨进程共享。
let accessToken: string | null = null;
let accessTokenExpireAt = 0; // 到期时刻（毫秒 epoch），到点前视为有效
let inflight: Promise<string> | null = null; // 并发去重：同一时刻只发一次刷新请求

/** callApi：非 200 网络错误；errcode != 0 抛 errmsg；成功时剔除 errcode/errmsg */
async function callApi(method: 'GET' | 'POST', url: string, query: Record<string, string> = {}, data: Record<string, unknown> = {}): Promise<any> {
  const qs = new URLSearchParams(query);
  const full = qs.toString() ? `${url}?${qs}` : url;
  let res: Response;
  try {
    res = await fetch(BASE + full, {
      method,
      headers: {'Content-Type': 'application/json'},
      body: method === 'GET' ? undefined : JSON.stringify(data),
    });
  } catch (e) {
    throw new AppError(`Network Error, ${(e as Error).message}.`);
  }
  if (res.status !== 200) throw new AppError(`Network Error, code ${res.status}.`);
  const json: any = await res.json();
  if (json.errcode !== undefined && json.errcode !== 0) throw new AppError(String(json.errmsg));
  delete json.errcode;
  delete json.errmsg;
  return json;
}

/** 登录：code2session，返回 { openid, session_key, ... } */
export async function authCode2Session(code: string) {
  return callApi('GET', '/sns/jscode2session', {
    appid: config.wechat.appId,
    secret: config.wechat.appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  });
}

/** 获取 AccessToken（稳定版接口 getStableAccessToken：POST /cgi-bin/stable_token）
 *  与旧 /cgi-bin/token 完全隔离、更稳定，官方推荐替代。
 *  普通模式（force_refresh=false）：有效期内重复调用不会更新 token；
 *  进程内缓存并提前 300s 刷新，规避该接口 1 万次/分钟、50 万次/天 的频率限制。 */
export async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < accessTokenExpireAt) return accessToken;
  if (inflight) return inflight; // 已有刷新在途，复用同一请求
  inflight = (async () => {
    try {
      const res = await callApi('POST', '/cgi-bin/stable_token', {}, {
        grant_type: 'client_credential',
        appid: config.wechat.appId,
        secret: config.wechat.appSecret,
        force_refresh: false,
      });
      accessToken = res.access_token as string;
      accessTokenExpireAt = Date.now() + (Number(res.expires_in || 7200) - 300) * 1000;
      return accessToken;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 获取手机号 */
export async function getPhone(code: string) {
  const res = await callApi('POST', '/wxa/business/getuserphonenumber',
    {access_token: await getAccessToken()},
    {code});
  return res.phone_info;
}

/**
 * 解密加密的用户数据（AES-128-CBC，sessionKey/iv 为 base64，24 位长度校验保留原逻辑）
 * 注意：原 PHP 实现要求 sessionKey/iv 长度为 24，行为保持一致。
 */
export function decryptData(encryptedData: string, sessionKey: string, iv: string): any {
  if (sessionKey.length !== 24) throw new AppError('EncodingAesKey非法');
  if (iv.length !== 24) throw new AppError('Iv非法');
  const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(sessionKey, 'base64'), Buffer.from(iv, 'base64'));
  let result = decipher.update(Buffer.from(encryptedData, 'base64'), undefined, 'utf8');
  result += decipher.final('utf8');
  let dataObj: any;
  try {
    dataObj = JSON.parse(result);
  } catch {
    dataObj = null;
  }
  if (dataObj == null) throw new AppError('AES解密失败');
  if (dataObj.watermark?.appid !== config.wechat.appId) throw new AppError('AES解密失败');
  return dataObj;
}
