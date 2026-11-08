import { serve } from '@hono/node-server';
import app from './app.js';
import { config } from './config.js';
import { initMqtt, endMqtt } from './services/mqtt.js';

// 建立常驻 MQTT 连接（非阻塞；broker 不可达时 mqtt.js 自动重连，不影响 HTTP 起服）
initMqtt();

serve({
  fetch: app.fetch,
  port: config.app.port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

// 优雅退出：关闭 MQTT 连接
process.on('SIGINT', () => {
  endMqtt();
  process.exit(0);
});
