// 运营管理领域路由
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { adminAuth } from '../../utils/middleware.js';
import { body, zFlag, zInt, zNum } from '../../utils/validator.js';
import { AppError, ok } from '../../utils/responses.js';
import { calculateExpire, dateOffsetDays, tsNow } from '../../utils/date.js';
import { addMoney, toMoney } from '../../utils/money.js';
import { insertBalanceLog } from '../../models/balance_log.js';
import { findUser, updateUser, withDays } from '../../models/user.js';

export const adminRouter = new Hono();

adminRouter.use('*', adminAuth);

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
 * 管理员调配充值（余额/有效天数）
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
        if (v.type !== 1 && v.type !== 2) ctx.addIssue({ code: 'custom', message: '类型取值错误（1余额，2天数）', path: ['type'] });
        if (v.type === 2 && !Number.isInteger(v.num)) ctx.addIssue({ code: 'custom', message: '天数必须是整数', path: ['num'] });
      })
  );

  await db.transaction().execute(async (trx) => {
    const user = await findUser(trx, id);
    if (!user) throw new AppError('用户不存在!');

    if (type === 1) {
      const balance = Math.max(addMoney(user.balance, num), 0);
      await trx.updateTable('mug_user').set({ balance, update_time: tsNow() }).where('id', '=', user.id).execute();
      await insertBalanceLog(trx, {
        user_id: user.id,
        balance,
        num: toMoney(num),
        type: 4,
      });
    } else if (type === 2) {
      // 调配音游畅玩天数：按早 6 点结算与累加
      const newExpire = calculateExpire(user.arcade_expire_date, num);
      await trx.updateTable('mug_user').set({
        arcade_expire_date: newExpire,
        update_time: tsNow(),
      }).where('id', '=', user.id).execute();
    } else if (type === 3) {
      // 调配卡牌 TCG 通行证天数：按早 6 点结算与累加
      const newExpire = calculateExpire(user.tcg_expire_date, num);
      await trx.updateTable('mug_user').set({
        tcg_expire_date: newExpire,
        update_time: tsNow(),
      }).where('id', '=', user.id).execute();
    }
  });

  return c.json(ok('操作成功'));
});
