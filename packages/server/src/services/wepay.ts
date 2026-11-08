// 微信支付 APIv3 SDK（对应 app/facade/WePaySdkFacade.php）
// 改用 wechatpay-axios-plugin：下单/关单等上行请求由库内置签名/验签 transformer 处理；
// paySign、回调验签、回调解密复用库的 Rsa / Formatter / Aes.AesGcm 原语。
// 接入模式为「微信支付公钥」（PUB_KEY_ID_xxx），免平台证书下载与轮换。
import fs from 'node:fs';
import path from 'node:path';
import type {KeyObject} from 'node:crypto';
import {Aes, Formatter, Rsa, Wechatpay} from 'wechatpay-axios-plugin';
import {config} from '../config.js';
import {AppError} from '../utils/responses.js';

// Aes.AesGcm 是运行时挂在 Aes 上的命名空间成员，类型定义未导出到顶层，这里做显式声明
const {AesGcm} = Aes as unknown as {
  AesGcm: { decrypt(ciphertext: string, key: string, iv: string, aad?: string): string };
};

// ---- PEM 读取（路径来自 config，兼容老项目 'file://' 前缀；懒加载，缺证书不影响其他接口启动）----
function loadKey(pemPath: string): string {
  const clean = pemPath.replace(/^file:\/\//, '');
  const full = path.resolve(process.cwd(), clean);
  if (fs.existsSync(full)) return fs.readFileSync(full, 'utf8');
  throw new AppError(`证书文件不存在: ${clean}`);
}

// 商户 API 私钥（PEM 文本）
function merchantKeyPem(): string {
  return loadKey(config.wechat.payMchKey);
}

// 微信支付公钥（PEM 文本）
function pubKeyPem(): string {
  return loadKey(config.wechat.payPubKeyPath);
}

let _wxpay: Wechatpay | null = null;
let _merchantKeyObj: KeyObject | null = null;
let _pubKeyObj: KeyObject | null = null;

/** APIv3 客户端单例：上行自动签名，下行自动验签 */
function wxpay(): Wechatpay {
  return (_wxpay ??= new Wechatpay({
    mchid: config.wechat.payMchId,
    serial: config.wechat.payMchCertSerial, // 商户 API 证书序列号
    privateKey: merchantKeyPem(),
    // 「微信支付公钥」模式：key 为公钥 ID(PUB_KEY_ID_xxx)，value 为公钥
    certs: {[config.wechat.payPubKeyId]: pubKeyObj()},
  }));
}

/** 商户私钥 KeyObject（用于 paySign） */
function merchantKeyObj(): KeyObject {
  return (_merchantKeyObj ??= Rsa.from(merchantKeyPem(), Rsa.KEY_TYPE_PRIVATE));
}

/** 微信支付公钥 KeyObject（用于回调验签） */
function pubKeyObj(): KeyObject {
  return (_pubKeyObj ??= Rsa.from(pubKeyPem(), Rsa.KEY_TYPE_PUBLIC));
}

/** 统一把 axios 错误转成 AppError */
function toAppError(action: string, err: unknown): AppError {
  const resp = (err as { response?: { status?: number, data?: { message?: string } } })?.response;
  const detail = resp ? `${resp.status ?? ''} ${resp.data?.message ?? ''}`.trim() : (err as Error)?.message ?? '';
  return new AppError(`微信支付${action}失败: ${detail}`);
}

/**
 * 统一下单（JSAPI），返回 prepay_id
 * @param param 业务参数 { description, out_trade_no, amount, payer, ... }
 */
export async function createOrder(param: Record<string, unknown>): Promise<string> {
  try {
    const {data} = await wxpay().v3.pay.transactions.jsapi.post({
      appid: config.wechat.appId,
      mchid: config.wechat.payMchId,
      notify_url: `https://${config.app.host}/wepay/callback`,
      ...param,
    });
    return (data as unknown as { prepay_id: string }).prepay_id;
  } catch (err) {
    throw toAppError('下单', err);
  }
}

/** 关闭订单 */
export async function closeOrder(outTradeNo: string): Promise<void> {
  try {
    // $placeholder$ 语法糖转换为 {out_trade_no}，含大写时需经第二参数传递
    await wxpay().v3.pay.transactions.outTradeNo.$out_trade_no$.close.post(
      {mchid: config.wechat.payMchId},
      {out_trade_no: outTradeNo},
    );
  } catch (err) {
    throw toAppError('关单', err);
  }
}

/** 小程序调起支付签名（paySign） */
export function paySign(prepayId: string): Record<string, string> {
  const params = {
    appId: config.wechat.appId,
    timeStamp: `${Formatter.timestamp()}`,
    nonceStr: Formatter.nonce(),
    package: `prepay_id=${prepayId}`,
    signType: 'RSA',
  };
  const paySignValue = Rsa.sign(
    Formatter.joinedByLineFeed(params.appId, params.timeStamp, params.nonceStr, params.package),
    merchantKeyObj(),
  );
  return {...params, paySign: paySignValue};
}

/**
 * 回调验签
 * @param headers 请求头（小写 key）
 * @param body 原始请求体字符串（必须是未解析的原文）
 */
export function verifyCallback(headers: Record<string, string>, body: string): void {
  const serial = headers['wechatpay-serial'];
  const signature = headers['wechatpay-signature'] ?? '';
  const timestamp = headers['wechatpay-timestamp'] ?? '';
  const nonceStr = headers['wechatpay-nonce'] ?? '';
  // 检查微信支付公钥 ID（公钥模式下 Wechatpay-Serial 返回 PUB_KEY_ID_xxx）
  if (serial !== config.wechat.payPubKeyId) throw new AppError('微信支付公钥ID不匹配');
  // 通知时间偏移 5 分钟内
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) throw new AppError('请求超时');
  // 验签：timestamp\nnonce\nbody\n
  if (!Rsa.verify(Formatter.response(timestamp, nonceStr, body), signature, pubKeyObj())) {
    throw new AppError('签名验证失败');
  }
}

/**
 * 回调解密（AEAD_AES_256_GCM，密钥为 APIv3 key）
 * @param resource 回调报文中的 resource 字段
 */
export function decryptCallback(resource: { ciphertext: string, nonce: string, associated_data?: string }): any {
  const plain = AesGcm.decrypt(
    resource.ciphertext,
    config.wechat.payV3Key,
    resource.nonce,
    resource.associated_data ?? '',
  );
  return JSON.parse(plain);
}
