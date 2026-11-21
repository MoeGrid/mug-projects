// 资产与支付领域路由
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client.js';
import * as WePaySdk from '../../services/wepay.js';
import * as Snowflake from '../../services/snowflake.js';
import { userAuth } from '../../utils/middleware.js';
import { body, zInt, zNum } from '../../utils/validator.js';
import { AppError, ok } from '../../utils/responses.js';
import { dateTimeStr, daysFromExpire, now, parseDate, tsNow } from '../../utils/date.js';
import { addMoney, toCents, toMoney } from '../../utils/money.js';
import { findActiveEvent, listActiveEvents } from '../../models/event.js';
import { createOrder, findOrderByWeOrderId } from '../../models/order.js';
import { findUserForUpdate } from '../../models/user.js';
import { insertBalanceLog } from '../../models/balance_log.js';

export const walletRouter = new Hono();

const currentUser = (c) => c.get('user');

// ---------------------------------------------------------------------------
// 1. 公开端点：微信支付异步结果安全回调
// ---------------------------------------------------------------------------
/**
 * 支付成功结算：订单状态迁移与余额入账必须在同一事务里完成。
 *
 * 幂等靠「条件更新抢占」而不是给订单行加锁：
 * - 用 `UPDATE ... WHERE id = ? AND status = 0` 抢状态，命中 1 行的事务才继续入账；
 *   微信并发/重复投递通知时，后到的事务更新 0 行，直接幂等返回。
 * - 只按主键 id 更新，不依赖 `we_order_id` 是否有索引（否则 SELECT ... FOR UPDATE
 *   在无索引列上会锁住扫描到的所有订单行）。
 * - 余额是「先读后算再写」的值，入账前锁用户行，避免与投币/TCG/管理员调账互相覆盖。
 *
 * 注意：余额允许为负（罚款场景），这里不做非负限制。
 */
async function settlePaidOrder(decrypted) {
  const weOrderId = String(decrypted.out_trade_no);
  const paidTotal = Number(decrypted.amount?.total);

  const order = await findOrderByWeOrderId(db, weOrderId);
  // 未知订单不重试（避免微信无限重发），但必须留痕
  if (!order) {
    console.error(`PAY_CALLBACK_ORDER_NOT_FOUND: ${weOrderId}`);
    return;
  }
  // 已处理过（重复通知）：幂等返回成功
  if (Number(order.status) !== 0) return;

  if (!Number.isFinite(paidTotal) || toCents(order.amount) !== paidTotal) {
    throw new AppError('订单支付金额错误');
  }

  const payTime = decrypted.success_time
    ? dateTimeStr(new Date(parseDate(decrypted.success_time)))
    : tsNow();

  await db.transaction().execute(async (trx) => {
    // 原子抢占：只有把 status 从 0 改成 1 的那个事务才入账
    const claimed = await trx
      .updateTable('mug_order')
      .set({ status: 1, pay_time: payTime, update_time: tsNow() })
      .where('id', '=', order.id)
      .where('status', '=', 0)
      .executeTakeFirst();

    if (Number(claimed.numUpdatedRows) === 0) return;

    if (Number(order.type) !== 1) return;

    const user = await findUserForUpdate(trx, order.user_id);
    if (!user) throw new AppError('订单用户不存在');

    const balance = addMoney(user.balance, order.num);
    await trx
      .updateTable('mug_user')
      .set({ balance, update_time: tsNow() })
      .where('id', '=', user.id)
      .execute();

    await insertBalanceLog(trx, {
      user_id: user.id,
      change_amount: toMoney(order.num),
      balance_after: balance,
      type: 2, // 微信充值
      remark: '微信支付充值',
    });
  });
}

walletRouter.post('/wechat-pay/notify', async (c) => {
  try {
    const raw = await c.req.text();
    const headers = {};
    c.req.raw.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    WePaySdk.verifyCallback(headers, raw);

    const bodyJson = JSON.parse(raw);
    const decrypted = WePaySdk.decryptCallback(bodyJson.resource);

    if (decrypted.trade_state === 'SUCCESS') {
      await settlePaidOrder(decrypted);
    }
    return c.json({ code: 'SUCCESS', message: '成功' });
  } catch (e) {
    console.error(`PAY_CALLBACK_ERROR: ${e.message}\n${e.stack ?? ''}`);
    return c.json({ code: 'FAIL', message: e.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// 2. 需登录鉴权端点
// ---------------------------------------------------------------------------
walletRouter.use('*', userAuth);

/**
 * GET /api/v1/wallet/assets
 * 获取用户当前资产（余额、音游天数 arcade_days、TCG天数 tcg_days）
 */
walletRouter.get('/assets', (c) => {
  const user = currentUser(c);
  const arcadeDays = daysFromExpire(user.arcade_expire_date);
  const tcgDays = daysFromExpire(user.tcg_expire_date);
  return c.json(
    ok({
      balance: toMoney(user.balance),
      arcade_days: arcadeDays,
      tcg_days: tcgDays,
    })
  );
});

/**
 * GET /api/v1/wallet/packages
 * 获取当前特惠套餐列表
 */
walletRouter.get('/packages', async (c) => {
  const data = await listActiveEvents(now());
  return c.json(ok(data));
});

/**
 * POST /api/v1/wallet/orders/recharge
 * 创建自定义金额充值订单
 */
walletRouter.post('/orders/recharge', async (c) => {
  const { amount } = await body(
    c,
    z.object({
      amount: zNum('充值金额')
        .int('充值金额必须为整数')
        .min(1, '充值金额必须大于0')
        .max(199, '单笔充值金额必须小于200元'),
    })
  );
  const user = currentUser(c);
  const weOrderId = Snowflake.generate();

  await createOrder(db, {
    user_id: user.id,
    num: amount,
    amount,
    we_order_id: weOrderId,
    status: 0,
    type: 1,
  });

  const prepayId = await WePaySdk.createOrder({
    description: 'MUG-购买游戏币',
    out_trade_no: weOrderId,
    amount: {
      total: toCents(amount),
      currency: 'CNY',
    },
    payer: {
      openid: user.open_id,
    },
  });

  return c.json(ok(WePaySdk.paySign(prepayId)));
});

/**
 * POST /api/v1/wallet/orders/package
 * 购买特惠充值套餐订单
 */
walletRouter.post('/orders/package', async (c) => {
  const { packageId } = await body(
    c,
    z.object({
      packageId: zInt('套餐ID'),
    })
  );
  const user = currentUser(c);
  const event = await findActiveEvent(packageId, now());
  if (!event) throw new AppError('活动套餐已下架或不存在!');
  if (Number(event.amount) >= 200) {
    throw new AppError('充值套餐金额必须小于200元');
  }

  const weOrderId = Snowflake.generate();
  await createOrder(db, {
    user_id: user.id,
    num: event.num,
    amount: event.amount,
    we_order_id: weOrderId,
    status: 0,
    type: 1,
  });

  const prepayId = await WePaySdk.createOrder({
    description: `MUG-${event.name || '购买特惠套餐'}`,
    out_trade_no: weOrderId,
    amount: {
      total: toCents(event.amount),
      currency: 'CNY',
    },
    payer: {
      openid: user.open_id,
    },
  });

  return c.json(ok(WePaySdk.paySign(prepayId)));
});

/**
 * GET /api/v1/wallet/transactions
 * 分页查询资产明细流水（纯财务资金流动）
 */
walletRouter.get('/transactions', async (c) => {
  const rows = Math.max(parseInt(c.req.query('rows') || '20', 10), 1);
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const user = currentUser(c);

  const buildQuery = () =>
    db.selectFrom('mug_balance_log').where('user_id', '=', user.id);

  const totalRow = await buildQuery().select(({ fn }) => fn.countAll().as('cnt')).executeTakeFirst();
  const total = Number(totalRow?.cnt ?? 0);

  const logs = await buildQuery()
    .selectAll()
    .orderBy('create_time', 'desc')
    .limit(rows)
    .offset((page - 1) * rows)
    .execute();

  return c.json(
    ok({
      total,
      per_page: rows,
      current_page: page,
      last_page: Math.max(Math.ceil(total / rows), 1),
      data: logs.map((item) => ({
        id: item.id,
        user_id: item.user_id,
        change_amount: toMoney(item.change_amount),
        balance_after: toMoney(item.balance_after),
        type: item.type,
        remark: item.remark || (item.type === 2 ? '微信支付充值' : item.type === 1 ? '街机投币消费' : item.type === 3 ? '卡牌通行证开通' : '系统手动调配'),
        create_time: item.create_time,
      })),
    })
  );
});
