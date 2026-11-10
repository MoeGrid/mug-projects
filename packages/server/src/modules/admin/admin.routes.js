// 运营管理领域路由
import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../../db/client.js';
import { adminAuth } from '../../utils/middleware.js';
import { body, zFlag, zInt, zNum } from '../../utils/validator.js';
import { AppError, ok } from '../../utils/responses.js';
import {
  calculateExpire,
  daysFromExpire,
  startOfDayStr,
  startOfMonthStr,
  dateTimeStr,
  tsNow,
} from '../../utils/date.js';
import { addMoney, toMoney } from '../../utils/money.js';
import { insertBalanceLog } from '../../models/balance_log.js';
import { findUser, updateUser, withDays } from '../../models/user.js';

export const adminRouter = new Hono();

adminRouter.use('*', adminAuth);

/**
 * GET /api/v1/admin/finance/summary
 * 财务收支概览与在场实时统计（今日充值/月充值、今日消费/月消费、当前TCG在场畅玩人数）
 */
adminRouter.get('/finance/summary', async (c) => {
  const todayStart = startOfDayStr();
  const monthStart = startOfMonthStr();
  const now = dateTimeStr();

  // 1. 今日与当月充值总额（统计支付成功的微信充值订单）
  const rechargeRow = await db
    .selectFrom('mug_order')
    .select([
      sql`COALESCE(SUM(CASE WHEN pay_time >= ${todayStart} THEN amount ELSE 0 END), 0)`.as('today_recharge'),
      sql`COALESCE(SUM(CASE WHEN pay_time >= ${monthStart} THEN amount ELSE 0 END), 0)`.as('month_recharge'),
    ])
    .where('status', '=', 1)
    .executeTakeFirst();

  // 2. 今日与当月消费总额（统计余额扣减流水）
  const consumeRow = await db
    .selectFrom('mug_balance_log')
    .select([
      sql`COALESCE(SUM(CASE WHEN create_time >= ${todayStart} THEN ABS(change_amount) ELSE 0 END), 0)`.as('today_consume'),
      sql`COALESCE(SUM(CASE WHEN create_time >= ${monthStart} THEN ABS(change_amount) ELSE 0 END), 0)`.as('month_consume'),
    ])
    .where('change_amount', '<', 0)
    .executeTakeFirst();

  // 3. 当前有效营业周期内在场 TCG 畅玩人数
  const tcgActiveRow = await db
    .selectFrom('mug_tcg_record')
    .select(sql`COUNT(DISTINCT user_id)`.as('active_count'))
    .where('expire_time', '>', now)
    .executeTakeFirst();

  return c.json(
    ok({
      today_recharge: toMoney(rechargeRow?.today_recharge ?? 0),
      month_recharge: toMoney(rechargeRow?.month_recharge ?? 0),
      today_consume: toMoney(consumeRow?.today_consume ?? 0),
      month_consume: toMoney(consumeRow?.month_consume ?? 0),
      active_tcg_count: Number(tcgActiveRow?.active_count ?? 0),
    })
  );
});

/**
 * GET /api/v1/admin/finance/recharges
 * 充值记录明细列表（支持分页）
 */
adminRouter.get('/finance/recharges', async (c) => {
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const rows = Math.max(parseInt(c.req.query('rows') || '20', 10), 1);

  const countRow = await db
    .selectFrom('mug_order')
    .select(({ fn }) => fn.countAll().as('cnt'))
    .where('status', '=', 1)
    .executeTakeFirst();
  const total = Number(countRow?.cnt ?? 0);

  const list = await db
    .selectFrom('mug_order as o')
    .leftJoin('mug_user as u', 'o.user_id', 'u.id')
    .select([
      'o.id',
      'o.user_id',
      'o.amount',
      'o.num',
      'o.pay_time',
      'o.we_order_id',
      'u.nickname',
      'u.avatar',
      'u.phone',
    ])
    .where('o.status', '=', 1)
    .orderBy('o.pay_time', 'desc')
    .orderBy('o.id', 'desc')
    .limit(rows)
    .offset((page - 1) * rows)
    .execute();

  return c.json(
    ok({
      total,
      per_page: rows,
      current_page: page,
      last_page: Math.max(Math.ceil(total / rows), 1),
      data: list.map((item) => ({
        ...item,
        amount: toMoney(item.amount),
        num: toMoney(item.num),
      })),
    })
  );
});

/**
 * GET /api/v1/admin/finance/consumptions
 * 消费流水明细列表（投币、TCG开台、TCG月卡等）
 */
adminRouter.get('/finance/consumptions', async (c) => {
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const rows = Math.max(parseInt(c.req.query('rows') || '20', 10), 1);

  const countRow = await db
    .selectFrom('mug_balance_log')
    .select(({ fn }) => fn.countAll().as('cnt'))
    .where('change_amount', '<', 0)
    .executeTakeFirst();
  const total = Number(countRow?.cnt ?? 0);

  const list = await db
    .selectFrom('mug_balance_log as b')
    .leftJoin('mug_user as u', 'b.user_id', 'u.id')
    .select([
      'b.id',
      'b.user_id',
      'b.change_amount',
      'b.balance_after',
      'b.type',
      'b.remark',
      'b.create_time',
      'u.nickname',
      'u.avatar',
      'u.phone',
    ])
    .where('b.change_amount', '<', 0)
    .orderBy('b.id', 'desc')
    .limit(rows)
    .offset((page - 1) * rows)
    .execute();

  return c.json(
    ok({
      total,
      per_page: rows,
      current_page: page,
      last_page: Math.max(Math.ceil(total / rows), 1),
      data: list.map((item) => ({
        ...item,
        cost: toMoney(Math.abs(Number(item.change_amount))),
        balance_after: toMoney(item.balance_after),
      })),
    })
  );
});

/**
 * GET /api/v1/admin/tcg/active-sessions
 * 当前开通 TCG 畅玩的用户列表（供无人值守监控抽查使用）
 */
adminRouter.get('/tcg/active-sessions', async (c) => {
  const now = dateTimeStr();

  const list = await db
    .selectFrom('mug_tcg_record as r')
    .leftJoin('mug_user as u', 'r.user_id', 'u.id')
    .select([
      'r.id as session_id',
      'r.user_id',
      'r.cost',
      'r.is_monthly',
      'r.create_time',
      'r.expire_time',
      'u.nickname',
      'u.avatar',
      'u.phone',
      'u.tcg_expire_date',
    ])
    .where('r.expire_time', '>', now)
    .orderBy('r.id', 'desc')
    .execute();

  return c.json(
    ok(
      list.map((item) => {
        const monthlyDays = daysFromExpire(item.tcg_expire_date);
        return {
          session_id: item.session_id,
          user_id: item.user_id,
          nickname: item.nickname || '玩家',
          avatar: item.avatar || '',
          phone: item.phone || '',
          cost: toMoney(item.cost),
          is_monthly: Boolean(item.is_monthly),
          create_time: item.create_time,
          expire_time: item.expire_time,
          has_monthly_pass: monthlyDays > 0,
          tcg_days: monthlyDays,
        };
      })
    )
  );
});

/**
 * GET /api/v1/admin/users
 * 分页搜索与过滤用户列表
 */
adminRouter.get('/users', async (c) => {
  const keyword = c.req.query('keyword')?.trim() || null;
  const rows = Math.max(parseInt(c.req.query('rows') || '20', 10), 1);
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);

  const buildQuery = () => {
    let q = db.selectFrom('mug_user');
    if (keyword) {
      q = q.where((eb) =>
        eb.or([
          eb('id', '=', Number(keyword) || -1),
          eb('nickname', 'like', `%${keyword}%`),
          eb('open_id', 'like', `%${keyword}%`),
          eb('phone', 'like', `%${keyword}%`),
          eb('qq', 'like', `%${keyword}%`),
        ])
      );
    }
    return q;
  };

  const totalRow = await buildQuery().select(({ fn }) => fn.countAll().as('cnt')).executeTakeFirst();
  const total = Number(totalRow?.cnt ?? 0);

  const users = await buildQuery()
    .selectAll()
    .orderBy('is_admin', 'desc')
    .orderBy('id', 'asc')
    .limit(rows)
    .offset((page - 1) * rows)
    .execute();

  return c.json(
    ok({
      total,
      per_page: rows,
      current_page: page,
      last_page: Math.max(Math.ceil(total / rows), 1),
      data: users.map(withDays),
    })
  );
});

/**
 * GET /api/v1/admin/users/:id
 * 获取指定用户详情
 */
adminRouter.get('/users/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!id || Number.isNaN(id)) throw new AppError('用户ID无效');
  const user = await findUser(db, id);
  if (!user) throw new AppError('用户不存在!');
  return c.json(ok(withDays(user)));
});

/**
 * PATCH /api/v1/admin/users/:id
 * 管理员修改用户属性
 */
adminRouter.patch('/users/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!id || Number.isNaN(id)) throw new AppError('用户ID无效');

  const { is_admin, is_ban, phone, qq, remark } = await body(
    c,
    z.object({
      is_admin: zFlag('is_admin').nullish(),
      is_ban: zFlag('is_ban').nullish(),
      phone: z.string().max(32, '手机号过长').nullish(),
      qq: z.string().max(32, 'QQ过长').nullish(),
      remark: z.string().max(255, '备注过长').nullish(),
    })
  );

  const user = await findUser(db, id);
  if (!user) throw new AppError('用户不存在!');

  const patch = {};
  if (is_admin !== undefined && is_admin !== null) patch.is_admin = is_admin;
  if (is_ban !== undefined && is_ban !== null) patch.is_ban = is_ban;
  if (phone !== undefined) patch.phone = phone;
  if (qq !== undefined) patch.qq = qq;
  if (remark !== undefined) patch.remark = remark;

  await updateUser(db, id, patch);
  return c.json(ok('修改成功'));
});

/**
 * POST /api/v1/admin/users/:id/adjust-balance
 * 管理员调配用户资产（余额加减、MUG天数加减、TCG天数加减）
 */
adminRouter.post('/users/:id/adjust-balance', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!id || Number.isNaN(id)) throw new AppError('用户ID无效');

  const { type, num } = await body(
    c,
    z
      .object({
        type: zInt('type'),
        num: zNum('数量'),
      })
      .superRefine((v, ctx) => {
        if (v.type !== 1 && v.type !== 2 && v.type !== 3) {
          ctx.addIssue({ code: 'custom', message: '类型取值错误（1余额，2街机MUG天数，3TCG月卡天数）', path: ['type'] });
        }
        if ((v.type === 2 || v.type === 3) && !Number.isInteger(v.num)) {
          ctx.addIssue({ code: 'custom', message: '天数必须是整数', path: ['num'] });
        }
      })
  );

  return db.transaction().execute(async (trx) => {
    const user = await findUser(trx, id);
    if (!user) throw new AppError('用户不存在!');

    if (type === 1) {
      // 1. 余额调配（支持加款与扣款，最低保底 0 元）
      const balance = Math.max(addMoney(user.balance, num), 0);
      await trx.updateTable('mug_user').set({ balance, update_time: tsNow() }).where('id', '=', user.id).execute();
      await insertBalanceLog(trx, {
        user_id: user.id,
        change_amount: toMoney(num),
        balance_after: balance,
        type: 4,
        remark: num >= 0 ? `管理员补款 +¥${toMoney(num)}` : `管理员扣款 -¥${toMoney(Math.abs(num))}`,
      });
      return c.json(ok({ balance: toMoney(balance), message: '余额调配成功' }));
    }

    if (type === 2) {
      // 2. 调配音游 MUG 畅玩天数：按次日早 6 点结算与累加/扣减
      const newExpire = calculateExpire(user.arcade_expire_date, num);
      await trx.updateTable('mug_user').set({
        arcade_expire_date: newExpire,
        update_time: tsNow(),
      }).where('id', '=', user.id).execute();
      const arcadeDays = daysFromExpire(newExpire);
      return c.json(ok({ arcade_days: arcadeDays, arcade_expire_date: newExpire, message: 'MUG天数调配成功' }));
    }

    if (type === 3) {
      // 3. 调配卡牌 TCG 通行证天数：按次日早 6 点结算与累加/扣减
      const newExpire = calculateExpire(user.tcg_expire_date, num);
      await trx.updateTable('mug_user').set({
        tcg_expire_date: newExpire,
        update_time: tsNow(),
      }).where('id', '=', user.id).execute();
      const tcgDays = daysFromExpire(newExpire);
      return c.json(ok({ tcg_days: tcgDays, tcg_expire_date: newExpire, message: 'TCG月卡天数调配成功' }));
    }
  });
});
