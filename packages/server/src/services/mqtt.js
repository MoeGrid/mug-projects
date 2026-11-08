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
