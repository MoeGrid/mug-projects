// 卡牌专区领域路由（TCG）
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { userAuth } from '../../utils/middleware.js';
import { body } from '../../utils/validator.js';
import { AppError, ok } from '../../utils/responses.js';
import { calculateTcgExpire, daysFromTcgExpire } from '../../utils/date.js';
import { subMoney, toMoney } from '../../utils/money.js';
import { findUser, updateUser } from '../../models/user.js';
import { insertBalanceLog } from '../../models/balance_log.js';

export const tcgRouter = new Hono();

tcgRouter.use('*', userAuth);

const currentUser = (c) => c.get('user');

export const TCG_PASS_PLANS = {
  day: {
    id: 'day',
    name: '充值 1 天 (+1天)',
    price: 15,
    days: 1,
    badge: '单日畅玩',
    desc: '当天有效，次日早 6:00 前有效，可自由累加',
  },
  monthly: {
    id: 'monthly',
    name: '充值 30 天 (+30天)',
    price: 180,
    days: 30,
    badge: '特惠畅玩',
    desc: '包含当天整整30天，统一早 6:00 结算，可自由累加',
  },
};

/**
 * GET /api/v1/tcg/passes/options
 * 获取 TCG 卡牌通行证套餐配置
 */
tcgRouter.get('/passes/options', (c) => {
  return c.json(ok(Object.values(TCG_PASS_PLANS)));
});

/**
 * POST /api/v1/tcg/passes/recharge
 * 使用账户余额开通/续期 TCG 通行证天数（支持累加）
 */
tcgRouter.post('/passes/recharge', async (c) => {
  const { planId } = await body(
    c,
    z.object({
      planId: z.enum(['day', 'monthly'], {
        errorMap: () => ({ message: '无效的通行证方案' }),
      }),
    })
  );

  const plan = TCG_PASS_PLANS[planId];
  const user = currentUser(c);

  return db.transaction().execute(async (trx) => {
    const freshUser = await findUser(trx, user.id);
    if (!freshUser) throw new AppError('用户不存在');

    const currentBalance = freshUser.balance;
    if (Number(currentBalance) < plan.price) {
      throw new AppError(`账户余额不足（当前 ¥${toMoney(currentBalance)}，需要 ¥${plan.price}），请先充值`);
    }

    const newBalance = subMoney(currentBalance, plan.price);
    const newExpire = calculateTcgExpire(freshUser.tcg_expire_date, plan.days);

    // 1. 更新用户余额与 TCG 到期时间
    await updateUser(trx, user.id, {
      balance: newBalance,
      tcg_expire_date: newExpire,
    });

    // 2. 写入纯资金流水（业务类型 3: 卡牌通行证）
    await insertBalanceLog(trx, {
      user_id: user.id,
      change_amount: -toMoney(plan.price),
      balance_after: newBalance,
      type: 3, // 卡牌通行证
      remark: `充值TCG通行天数(+${plan.days}天)`,
    });

    const remainingDays = daysFromTcgExpire(newExpire);

    return c.json(
      ok({
        plan: plan.name,
        add_days: plan.days,
        tcg_days: remainingDays,
        tcg_expire_date: newExpire,
        balance: toMoney(newBalance),
      })
    );
  });
});

/**
 * GET /api/v1/tcg/events
 * 获取近期 TCG 赛事与活动列表
 */
tcgRouter.get('/events', (c) => {
  return c.json(ok([]));
});
