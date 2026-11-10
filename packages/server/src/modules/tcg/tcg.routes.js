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
import { getJsonSetting } from '../../models/setting.js';

export const tcgRouter = new Hono();

tcgRouter.use('*', userAuth);

const currentUser = (c) => c.get('user');

/** 获取 TCG 专区价格配置（支持 setting 动态配置） */
async function getTcgPricing() {
  const setting = await getJsonSetting('tcg_pass_setting', { day_price: 15, month_price: 180 });
  return {
    day_price: Number(setting?.day_price ?? 15),
    month_price: Number(setting?.month_price ?? 180),
  };
}

/**
 * GET /api/v1/tcg/passes/options
 * 获取 TCG 专区价格配置及当前用户状态
 */
tcgRouter.get('/passes/options', async (c) => {
  const pricing = await getTcgPricing();
  const user = currentUser(c);
  const freshUser = await findUser(db, user.id);
  const remainingDays = daysFromTcgExpire(freshUser?.tcg_expire_date);
  const isActiveToday = remainingDays > 0;
  const hasMonthlyPass = remainingDays > 1;

  return c.json(
    ok({
      day_price: pricing.day_price,
      month_price: pricing.month_price,
      is_active_today: isActiveToday,
      has_monthly_pass: hasMonthlyPass,
      tcg_days: remainingDays,
      tcg_expire_date: freshUser?.tcg_expire_date || null,
    })
  );
});

/**
 * POST /api/v1/tcg/passes/activate
 * 开启今日畅玩（类似网吧上机开台，每日点一次扣 n 余额，次日凌晨 6 点自动截止）
 * - 若用户持有有效月卡或今日已开启：不扣除余额，直接返回生效状态
 * - 若今日未开启：扣除单日费用，有效期设置至次日早 06:00:00
 */
tcgRouter.post('/passes/activate', async (c) => {
  const user = currentUser(c);
  const pricing = await getTcgPricing();
  const dayPrice = pricing.day_price;

  return db.transaction().execute(async (trx) => {
    const freshUser = await findUser(trx, user.id);
    if (!freshUser) throw new AppError('用户不存在');

    const remainingDays = daysFromTcgExpire(freshUser.tcg_expire_date);

    // 1. 若当前已在有效期内（月卡特权生效中，或今日已开启过）
    if (remainingDays > 0) {
      return c.json(
        ok({
          already_active: true,
          deducted: 0,
          has_monthly_pass: remainingDays > 1,
          tcg_days: remainingDays,
          tcg_expire_date: freshUser.tcg_expire_date,
          balance: toMoney(freshUser.balance),
          message:
            remainingDays > 1
              ? '您持有有效月卡，畅玩特权已生效，无需扣费'
              : '今日畅玩特权已在生效中，次日早 06:00 自动到期，无需重复开启',
        })
      );
    }

    // 2. 今日未生效：扣除单日费用并开启至次日早 06:00:00
    const currentBalance = freshUser.balance;
    if (Number(currentBalance) < dayPrice) {
      throw new AppError(`账户余额不足（当前 ¥${toMoney(currentBalance)}，开启今日畅玩需 ¥${dayPrice}），请先充值`);
    }

    const newBalance = subMoney(currentBalance, dayPrice);
    const newExpire = calculateTcgExpire(null, 1); // 次日 06:00:00

    await updateUser(trx, user.id, {
      balance: newBalance,
      tcg_expire_date: newExpire,
    });

    await insertBalanceLog(trx, {
      user_id: user.id,
      change_amount: -toMoney(dayPrice),
      balance_after: newBalance,
      type: 3, // TCG 专区
      remark: `开启今日TCG畅玩(扣除¥${dayPrice})`,
    });

    const newRemainingDays = daysFromTcgExpire(newExpire);

    return c.json(
      ok({
        already_active: false,
        deducted: dayPrice,
        has_monthly_pass: false,
        tcg_days: newRemainingDays,
        tcg_expire_date: newExpire,
        balance: toMoney(newBalance),
        message: `开启成功！已扣除余额 ¥${dayPrice}，今日畅玩特权已生效至次日早 06:00`,
      })
    );
  });
});

/**
 * POST /api/v1/tcg/passes/buy-monthly
 * 开通 / 续费 TCG 畅玩月卡（未来 30 天每日畅玩均不扣除余额）
 */
tcgRouter.post('/passes/buy-monthly', async (c) => {
  const user = currentUser(c);
  const pricing = await getTcgPricing();
  const monthPrice = pricing.month_price;

  return db.transaction().execute(async (trx) => {
    const freshUser = await findUser(trx, user.id);
    if (!freshUser) throw new AppError('用户不存在');

    const currentBalance = freshUser.balance;
    if (Number(currentBalance) < monthPrice) {
      throw new AppError(`账户余额不足（当前 ¥${toMoney(currentBalance)}，开通月卡需 ¥${monthPrice}），请先充值`);
    }

    const newBalance = subMoney(currentBalance, monthPrice);
    const newExpire = calculateTcgExpire(freshUser.tcg_expire_date, 30);

    await updateUser(trx, user.id, {
      balance: newBalance,
      tcg_expire_date: newExpire,
    });

    await insertBalanceLog(trx, {
      user_id: user.id,
      change_amount: -toMoney(monthPrice),
      balance_after: newBalance,
      type: 3,
      remark: `开通TCG畅玩月卡(+30天,¥${monthPrice})`,
    });

    const remainingDays = daysFromTcgExpire(newExpire);

    return c.json(
      ok({
        deducted: monthPrice,
        has_monthly_pass: true,
        tcg_days: remainingDays,
        tcg_expire_date: newExpire,
        balance: toMoney(newBalance),
        message: `开通成功！已成功获得 30 天 TCG 畅玩月卡特权，整月畅玩无需扣费`,
      })
    );
  });
});

/**
 * POST /api/v1/tcg/passes/recharge
 * 兼容旧接口方案转发
 */
tcgRouter.post('/passes/recharge', async (c) => {
  const { planId } = await body(
    c,
    z.object({
      planId: z.enum(['day', 'monthly']),
    })
  );

  if (planId === 'day') {
    // 转发至 activate
    const pricing = await getTcgPricing();
    const dayPrice = pricing.day_price;
    const user = currentUser(c);
    return db.transaction().execute(async (trx) => {
      const freshUser = await findUser(trx, user.id);
      if (!freshUser) throw new AppError('用户不存在');
      const currentBalance = freshUser.balance;
      if (Number(currentBalance) < dayPrice) {
        throw new AppError(`账户余额不足（当前 ¥${toMoney(currentBalance)}，开启今日畅玩需 ¥${dayPrice}），请先充值`);
      }
      const newBalance = subMoney(currentBalance, dayPrice);
      const newExpire = calculateTcgExpire(freshUser.tcg_expire_date, 1);
      await updateUser(trx, user.id, { balance: newBalance, tcg_expire_date: newExpire });
      await insertBalanceLog(trx, {
        user_id: user.id,
        change_amount: -toMoney(dayPrice),
        balance_after: newBalance,
        type: 3,
        remark: `充值TCG畅玩天数(+1天,¥${dayPrice})`,
      });
      const remainingDays = daysFromTcgExpire(newExpire);
      return c.json(
        ok({
          plan: '开启今日畅玩',
          add_days: 1,
          tcg_days: remainingDays,
          tcg_expire_date: newExpire,
          balance: toMoney(newBalance),
        })
      );
    });
  } else {
    // monthly
    const pricing = await getTcgPricing();
    const monthPrice = pricing.month_price;
    const user = currentUser(c);
    return db.transaction().execute(async (trx) => {
      const freshUser = await findUser(trx, user.id);
      if (!freshUser) throw new AppError('用户不存在');
      const currentBalance = freshUser.balance;
      if (Number(currentBalance) < monthPrice) {
        throw new AppError(`账户余额不足（当前 ¥${toMoney(currentBalance)}，开通月卡需 ¥${monthPrice}），请先充值`);
      }
      const newBalance = subMoney(currentBalance, monthPrice);
      const newExpire = calculateTcgExpire(freshUser.tcg_expire_date, 30);
      await updateUser(trx, user.id, { balance: newBalance, tcg_expire_date: newExpire });
      await insertBalanceLog(trx, {
        user_id: user.id,
        change_amount: -toMoney(monthPrice),
        balance_after: newBalance,
        type: 3,
        remark: `开通TCG畅玩月卡(+30天,¥${monthPrice})`,
      });
      const remainingDays = daysFromTcgExpire(newExpire);
      return c.json(
        ok({
          plan: '开通TCG畅玩月卡',
          add_days: 30,
          tcg_days: remainingDays,
          tcg_expire_date: newExpire,
          balance: toMoney(newBalance),
        })
      );
    });
  }
});

/**
 * GET /api/v1/tcg/events
 * 获取近期 TCG 赛事与活动列表
 */
tcgRouter.get('/events', (c) => {
  return c.json(ok([]));
});
