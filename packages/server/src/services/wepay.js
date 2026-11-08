// 微信支付 APIv3 SDK（微信支付公钥模式）
import fs from 'node:fs';
import path from 'node:path';
import { Aes, Formatter, Rsa, Wechatpay } from 'wechatpay-axios-plugin';
import { config } from '../config.js';
import { AppError } from '../utils/responses.js';

const { AesGcm } = Aes;

function loadKey(pemPath) {
  const clean = pemPath.replace(/^file:\/\//, '');
  const full = path.resolve(process.cwd(), clean);
  if (fs.existsSync(full)) return fs.readFileSync(full, 'utf8');
  throw new AppError(`证书文件不存在: ${clean}`);
}

function merchantKeyPem() {
  return loadKey(config.wechat.payMchKey);
}

function pubKeyPem() {
  return loadKey(config.wechat.payPubKeyPath);
}

let _wxpay = null;
let _merchantKeyObj = null;
let _pubKeyObj = null;

function wxpay() {
  return (_wxpay ??= new Wechatpay({
    mchid: config.wechat.payMchId,
    serial: config.wechat.payMchCertSerial,
    privateKey: merchantKeyPem(),
    certs: { [config.wechat.payPubKeyId]: pubKeyObj() },
  }));
}

function merchantKeyObj() {
  return (_merchantKeyObj ??= Rsa.from(merchantKeyPem(), Rsa.KEY_TYPE_PRIVATE));
}

function pubKeyObj() {
  return (_pubKeyObj ??= Rsa.from(pubKeyPem(), Rsa.KEY_TYPE_PUBLIC));
}

function toAppError(action, err) {
  const resp = err?.response;
  const detail = resp ? `${resp.status ?? ''} ${resp.data?.message ?? ''}`.trim() : err?.message ?? '';
  return new AppError(`微信支付${action}失败: ${detail}`);
}

/** 统一下单（JSAPI） */
export async function createOrder(param) {
  try {
    const { data } = await wxpay().v3.pay.transactions.jsapi.post({
      appid: config.wechat.appId,
      mchid: config.wechat.payMchId,
      notify_url: `https://${config.app.host}/api/v1/wallet/wechat-pay/notify`,
      ...param,
    });
    return data.prepay_id;
  } catch (err) {
    throw toAppError('下单', err);
  }
}

/** 关单（备用） */
export async function closeOrder(outTradeNo) {
  try {
    await wxpay().v3.pay.transactions.outTradeNo.$out_trade_no$.close.post(
      { mchid: config.wechat.payMchId },
      { out_trade_no: outTradeNo }
    );
  } catch (err) {
    throw toAppError('关单', err);
  }
}

/** 小程序调起支付签名（paySign） */
export function paySign(prepayId) {
  const params = {
    appId: config.wechat.appId,
    timeStamp: `${Formatter.timestamp()}`,
    nonceStr: Formatter.nonce(),
    package: `prepay_id=${prepayId}`,
    signType: 'RSA',
  };
  const paySignValue = Rsa.sign(
    Formatter.joinedByLineFeed(params.appId, params.timeStamp, params.nonceStr, params.package),
    merchantKeyObj()
  );
  return { ...params, paySign: paySignValue };
}

/** 回调验签 */
export function verifyCallback(headers, body) {
  const serial = headers['wechatpay-serial'];
  const signature = headers['wechatpay-signature'] ?? '';
  const timestamp = headers['wechatpay-timestamp'] ?? '';
  const nonceStr = headers['wechatpay-nonce'] ?? '';

  if (serial !== config.wechat.payPubKeyId) throw new AppError('微信支付公钥ID不匹配');
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) throw new AppError('请求超时');

  if (!Rsa.verify(Formatter.response(timestamp, nonceStr, body), signature, pubKeyObj())) {
    throw new AppError('签名验证失败');
  }
}

/** 回调解密 */
export function decryptCallback(resource) {
  const plain = AesGcm.decrypt(
    resource.ciphertext,
    config.wechat.payV3Key,
    resource.nonce,
    resource.associated_data ?? ''
  );
  return JSON.parse(plain);
}
