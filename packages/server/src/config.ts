// 环境变量配置（对应老项目 config/*.php，读取 .env）
import 'dotenv/config';

function str(key: string, def = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? def : v;
}

function num(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isNaN(n) ? def : n;
}

function bool(key: string, def: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  return /^(1|true|yes|on)$/i.test(v);
}

export const config = {
  // 应用（config/app.php）
  app: {
    debug: bool('APP_DEBUG', false),
    host: str('APP_HOST'), // 应用域名，用于微信支付回调地址
    port: num('PORT', 3000),
    timezone: str('TZ', 'Asia/Shanghai'),
  },

  // 数据库（config/database.php 的 mug 连接）
  db: {
    host: str('DB_HOST', '127.0.0.1'),
    port: num('DB_PORT', 3306),
    user: str('DB_USER', 'root'),
    password: str('DB_PASSWORD', ''),
    database: str('DB_NAME', ''),
    charset: str('DB_CHARSET', 'utf8'),
  },

  // 登录令牌（config/token.php）
  token: {
    secret: str('AUTH_SECRET'),
    expire: num('AUTH_EXPIRE', 86400),
  },

  // 微信小程序（config/wechat.php）；支付改用 wechatpay-axios-plugin「微信支付公钥」模式
  wechat: {
    appId: str('WECHAT_APP_ID'),
    appSecret: str('WECHAT_APP_SECRET'),
    payMchId: str('WECHAT_PAY_MCHID'),
    payV3Key: str('WECHAT_PAY_V3KEY'),
    payMchCertSerial: str('WECHAT_PAY_MCH_CERT_SERIAL'), // 商户API证书序列号
    payMchKey: str('WECHAT_PAY_MCH_KEY', 'data/pay/mch_key.pem'),
    payPubKeyId: str('WECHAT_PAY_PUB_KEY_ID') || str('WECHAT_PAY_PLATFORM_CERT_SERIAL'), // 微信支付公钥ID(PUB_KEY_ID_xxx)
    payPubKeyPath: str('WECHAT_PAY_PUB_KEY_PATH') || str('WECHAT_PAY_PLATFORM_KEY', 'data/pay/pub_key.pem'), // 微信支付公钥PEM
  },

  // MQTT broker（投币指令直连发布 / 订阅回执，取代原 EMQX HTTP API）
  mqtt: {
    host: str('MQTT_HOST'),
    port: num('MQTT_PORT', 1883),
    username: str('MQTT_USERNAME'),
    password: str('MQTT_PASSWORD'),
    clientId: str('MQTT_CLIENT_ID', 'mug-backend'),
  },

  // 文件系统（config/filesystem.php 的 public 磁盘）
  fs: {
    publicRoot: str('STORAGE_ROOT', 'public/storage'),
    publicUrl: '/storage',
  },
};

export type AppConfig = typeof config;
