// MQTT 连接与远程投币发布
import mqtt from 'mqtt';
import { config } from '../config.js';

let client = null;
const waitQueue = new Map();

export function initMqtt() {
  if (client) return;
  const url = `mqtt://${config.mqtt.host}:${config.mqtt.port}`;
  client = mqtt.connect(url, {
    clientId: config.mqtt.clientId,
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    client.subscribe('device/+/coin/resp', { qos: 1 });
  });

  client.on('message', (topic, payload) => {
    try {
      const resp = JSON.parse(payload.toString());
      if (resp && typeof resp.id === 'number' && waitQueue.has(resp.id)) {
        const resolve = waitQueue.get(resp.id);
        waitQueue.delete(resp.id);
        resolve(resp);
      }
    } catch {}
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err.message);
  });
}

export function endMqtt() {
  if (client) {
    client.end();
    client = null;
  }
}

/**
 * 通过 EMQX API 检测设备客户端是否在线（对应老项目 EMQXApi::getClient）
 * @param {string} clientId 客户端ID
 * @returns {Promise<boolean>}
 */
export async function isDeviceOnline(clientId) {
  if (!clientId) return false;
  // 若未配置 EMQX Key/Secret，降级放行（避免本地开发或未配置时直接阻断）
  if (!config.emqx?.host || !config.emqx?.key || !config.emqx?.secret) {
    return true;
  }

  try {
    const baseUrl = config.emqx.host.replace(/\/+$/, '');
    const url = `${baseUrl}/api/v5/clients/${encodeURIComponent(clientId)}`;
    const authHeader =
      'Basic ' + Buffer.from(`${config.emqx.key}:${config.emqx.secret}`).toString('base64');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 200) {
      const data = await res.json();
      // EMQX v5 中客户端在线标志为 connected: true
      return Boolean(data?.connected ?? true);
    }
    return false;
  } catch (err) {
    console.error(`EMQX 设备在线检查失败 [${clientId}]:`, err.message);
    return false;
  }
}

/** 直连投币指令 */
export async function insertCoin(deviceId, data, timeoutMs = 5000) {
  if (!client || !client.connected) {
    throw new Error('MQTT 服务未就绪');
  }
  const topic = `device/${deviceId}/coin/insert`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waitQueue.delete(data.id);
      reject(new Error('投币超时'));
    }, timeoutMs);

    waitQueue.set(data.id, (resp) => {
      clearTimeout(timer);
      resolve(resp);
    });

    client.publish(topic, JSON.stringify(data), { qos: 1 }, (err) => {
      if (err) {
        clearTimeout(timer);
        waitQueue.delete(data.id);
        reject(err);
      }
    });
  });
}
