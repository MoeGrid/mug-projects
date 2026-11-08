// Web 路由（对应 route/web.php + IndexController / WePayController）
import {Hono} from 'hono';
import {db} from '../db/client.js';
import * as WePaySdk from '../services/wepay.js';
import {parse} from '../utils/validator.js';
import {z} from 'zod';
import {AppError} from '../utils/responses.js';
import {dateTimeStr, parseDate, tsNow} from '../utils/date.js';
import {addMoney, toCents, toMoney} from '../utils/money.js';
import {findOrderByWeOrderId, updateOrder} from '../models/order.js';
import {insertBalanceLog} from '../models/balance_log.js';
import type {Env} from '../app.js';

export const webRouter = new Hono<Env>();

// GET / 首页
webRouter.get('/', (c) => c.text(':)'));

// POST /wepay/callback 微信支付回调
webRouter.post('/wepay/callback', async (c) => {
  try {
    // 读取原始报文（验签需要未解析的 body）
    const raw = await c.req.text();
    // 验证请求
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    WePaySdk.verifyCallback(headers, raw);

    // 解析参数
    const param = JSON.parse(raw);
    console.debug('PAY_CALLBACK:', param);
    const cb = parse(param, z.object({
      id: z.string('id必填').max(36),
      create_time: z.string('create_time必填').max(32),
      event_type: z.string('event_type必填').max(32),
      resource_type: z.string('resource_type必填').max(32),
      resource: z.record(z.string(), z.unknown()),
      summary: z.string('summary必填').max(64),
    }));
    const resource = parse(cb.resource, z.object({
      algorithm: z.string('algorithm必填').max(32),
      ciphertext: z.string('ciphertext必填'),
      associated_data: z.string('associated_data必填').max(16),
      original_type: z.string('original_type必填').max(16),
      nonce: z.string('nonce必填').max(16),
    }));

    // 通知类型过滤
    if (param.event_type !== 'TRANSACTION.SUCCESS') throw new AppError('事件类型无效');

    // 解密
    const decrypted = WePaySdk.decryptCallback(resource);
    console.debug('PAY_CALLBACK_RESOURCE:', decrypted);

    // 过滤支付失败
    if (decrypted.trade_state === 'SUCCESS') {
      // 更改订单状态
      const order = await findOrderByWeOrderId(db, String(decrypted.out_trade_no));
      // 判断订单状态
      if (order && order.status === 0) {
        // 检查支付金额（转分比对，彻底杜绝浮点数截断问题）
        if (toCents(order.amount) !== decrypted.amount.total) throw new AppError('订单支付金额错误');
        // 更新订单（pay_time = date('Y-m-d H:i:s', strtotime(success_time))）
        const payTime = dateTimeStr(new Date(parseDate(decrypted.success_time)));
        await updateOrder(db, order.id, {pay_time: payTime, status: 1});
        // 判断订单类型
        if (order.type === 1) {
          await buyCoin(order.id);
        }
      }
    }
    return c.json({code: 'SUCCESS', message: '成功'});
  } catch (e) {
    console.error(`PAY_CALLBACK_ERROR: ${(e as Error).message}\n${(e as Error).stack ?? ''}`);
    return c.json({code: 'FAIL', message: (e as Error).message}, 500);
  }
});

// 更新游戏币余额（对应 WePayController::buyCoin，独立事务）
async function buyCoin(orderId: number): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const order = await trx.selectFrom('mug_order').selectAll().where('id', '=', orderId).executeTakeFirstOrThrow();
    // 加余额（安全高精度加法，杜绝字符串拼接与浮点数精度丢失）
    const user = await trx.selectFrom('mug_user').selectAll().where('id', '=', order.user_id).executeTakeFirstOrThrow();
    const balance = addMoney(user.balance, order.num);
    await trx.updateTable('mug_user').set({balance, update_time: tsNow()}).where('id', '=', user.id).execute();
    // 记录
    await insertBalanceLog(trx, {
      user_id: user.id,
      balance,
      num: toMoney(order.num),
      type: 3,
    });
  });
}
