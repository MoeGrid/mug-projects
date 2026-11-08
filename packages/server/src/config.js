// 集中配置读取
import dotenv from 'dotenv';

dotenv.config();

function str(key, def = '') {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : def;
}

function num(key, def = 0) {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isNaN(n) ? def : n;
}

function bool(key, def = false) {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  return v === 'true' || v === '1';
}

export const config = {
  app: {
    debug: bool('APP_DEBUG', false),
    host: str('APP_HOST', 'localhost'),
    port: num('PORT', 3000),
  },

  db: {
    host: str('DB_HOST', '127.0.0.1'),
    port: num('DB_PORT', 3306),
    user: str('DB_USER', 'root'),
    password: str('DB_PASSWORD', ''),
    database: str('DB_NAME', ''),
    charset: str('DB_CHARSET', 'utf8mb4'),
  },

  token: {
    secret: str('AUTH_SECRET'),
    expire: num('AUTH_EXPIRE', 86400),
  },

  wechat: {
    appId: str('WECHAT_APP_ID'),
    appSecret: str('WECHAT_APP_SECRET'),
    payMchId: str('WECHAT_PAY_MCHID'),
    payV3Key: str('WECHAT_PAY_V3KEY'),
    payMchCertSerial: str('WECHAT_PAY_MCH_CERT_SERIAL'),
    payMchKey: str('WECHAT_PAY_MCH_KEY', 'data/pay/mch_key.pem'),
    payPubKeyId: str('WECHAT_PAY_PUB_KEY_ID') || str('WECHAT_PAY_PLATFORM_CERT_SERIAL'),
    payPubKeyPath: str('WECHAT_PAY_PUB_KEY_PATH') || str('WECHAT_PAY_PLATFORM_KEY', 'data/pay/pub_key.pem'),
  },

  mqtt: {
    host: str('MQTT_HOST'),
    port: num('MQTT_PORT', 1883),
    username: str('MQTT_USERNAME'),
    password: str('MQTT_PASSWORD'),
    clientId: str('MQTT_CLIENT_ID', 'mug-backend'),
  },

  fs: {
    publicRoot: str('STORAGE_ROOT', 'public/storage'),
  },
};
