// MQTT 直连（取代原 EMQX HTTP API 发布 + 规则落 Redis + 轮询的绕路）
// 常驻进程持有一条 broker 连接：发 device/{id}/coin/insert，订阅 device/+/coin/resp，
// 按回执 id 在内存挂起表里 resolve；5s 无回执统一当超时。
import mqtt, {type MqttClient} from 'mqtt';
import {config} from '../config.js';

type CoinResp = { code: number };
type Pending = { resolve: (r: CoinResp | null) => void; timer: NodeJS.Timeout };

const pending = new Map<string, Pending>();
let client: MqttClient | null = null;

/** 启动时调用：建连 + 订阅回执；断线由 mqtt.js 自动重连 */
export function initMqtt(): void {
  if (client) return;
  client = mqtt.connect(`mqtt://${config.mqtt.host}:${config.mqtt.port}`, {
    username: config.mqtt.username || undefined,
    password: config.mqtt.password || undefined,
    clientId: config.mqtt.clientId,
    keepalive: 60,
    clean: true,
    reconnectPeriod: 3000,
  });
  client.on('connect', () => client!.subscribe('device/+/coin/resp', {qos: 1}));
  client.on('message', (_topic, buf) => {
    let data: any;
    try {
      data = JSON.parse(buf.toString());
    } catch {
      return;
    }
    const key = String(data?.id ?? '');
    const p = pending.get(key);
    if (!p) return; // 非本次挂起，忽略
    pending.delete(key);
    clearTimeout(p.timer);
    p.resolve({code: Number(data?.code ?? 0)});
  });
  client.on('error', (e) => console.error('[mqtt]', e));
}

/**
 * 发布投币指令并等待回执。
 * @returns 收到回执返回 { code }；timeoutMs 内无回执返回 null（视为设备不在线/超时）；
 *          发布失败（未连接等）抛出异常。
 */
export function insertCoin(
  clientId: string,
  msg: { id: number; num: number },
  timeoutMs = 5000,
): Promise<CoinResp | null> {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      reject(new Error('MQTT not connected'));
      return;
    }
    const key = String(msg.id);
    const timer = setTimeout(() => {
      pending.delete(key);
      resolve(null);
    }, timeoutMs);
    pending.set(key, {resolve, timer});
    client.publish(`device/${clientId}/coin/insert`, JSON.stringify(msg), {qos: 1}, (err) => {
      if (err) {
        pending.delete(key);
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

/** 优雅退出：关闭连接并清空挂起表 */
export function endMqtt(): void {
  for (const [, p] of pending) clearTimeout(p.timer);
  pending.clear();
  client?.end(true);
  client = null;
}
