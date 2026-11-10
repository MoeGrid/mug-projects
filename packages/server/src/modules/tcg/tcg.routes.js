// 卡牌专区领域路由（TCG）
import { Hono } from 'hono';
import { db } from '../../db/client.js';
import { userAuth } from '../../utils/middleware.js';
import { AppError, ok } from '../../utils/responses.js';
import { calculateExpire, daysFromExpire } from '../../utils/date.js';
import { subMoney, toMoney } from '../../utils/money.js';
import { findUser, updateUser } from '../../models/user.js';
import { insertBalanceLog } from '../../models/balance_log.js';
import { getJsonSetting } from '../../models/setting.js';
import { findActiveTcgSession, insertTcgRecord } from '../../models/tcg_record.js';

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
 * 获取 TCG 专区价格配置及当前用户上机状态与月卡状态
 */
tcgRouter.get('/passes/options', async (c) => {
  const pricing = await getTcgPricing();
  const user = currentUser(c);
  const freshUser = await findUser(db, user.id);

  // 1. 月卡状态：纯粹由 tcg_expire_date 决定
  const monthlyDays = daysFromExpire(freshUser?.tcg_expire_date);
  const hasMonthlyPass = monthlyDays > 0;

  // 2. 今日是否在上机状态：由专门的 mug_tcg_record 上机记录表判定（expire_time > NOW()）
  const activeSession = await findActiveTcgSession(db, user.id);
  const isActiveToday = Boolean(activeSession);

  return c.json(
    ok({
      day_price: pricing.day_price,
      month_price: pricing.month_price,
      is_active_today: isActiveToday,
      active_session: activeSession || null,
      has_monthly_pass: hasMonthlyPass,
      tcg_days: monthlyDays,
      tcg_expire_date: freshUser?.tcg_expire_date || null,
      balance: toMoney(freshUser?.balance || 0),
    })
  );
});

/**
 * POST /api/v1/tcg/passes/activate
 * 开启今日畅玩（上机）：
 * - 不修改用户的 tcg_expire_date，在 mug_tcg_record 中记录本次上机会话
 * - 自动结束时间统一定为次日早 06:00:00
 * - 若用户持有有效月卡：扣费 0 元，记录 is_monthly = 1
 * - 若用户无月卡：扣除 day_price，记录 is_monthly = 0 并写余额账本
 */
tcgRouter.post('/passes/activate', async (c) => {
  const user = currentUser(c);
  const pricing = await getTcgPricing();
  const dayPrice = pricing.day_price;

  return db.transaction().execute(async (trx) => {
    const freshUser = await findUser(trx, user.id);
    if (!freshUser) throw new AppError('用户不存在');

    // 1. 检查当前是否已经在上机生效期内
    const activeSession = await findActiveTcgSession(trx, user.id);
    if (activeSession) {
      return c.json(
        ok({
          already_active: true,
          deducted: 0,
          active_session: activeSession,
          message: '今日已在畅玩中，统一至次日早 06:00 自动结束，无需重复开启',
        })
      );
    }

    // 2. 检查用户是否持有有效月卡
    const monthlyDays = daysFromExpire(freshUser.tcg_expire_date);
    const hasMonthlyPass = monthlyDays > 0;
    const sessionExpire = calculateExpire(null, 1); // 次日 06:00:00

    if (hasMonthlyPass) {
      // 月卡会员：0 元上机
      const sessionId = await insertTcgRecord(trx, {
        user_id: user.id,
        cost: 0,
        is_monthly: 1,
        expire_time: sessionExpire,
      });

      return c.json(
        ok({
          already_active: false,
          deducted: 0,
          is_monthly: true,
          session_id: sessionId,
          expire_time: sessionExpire,
          balance: toMoney(freshUser.balance),
          message: '月卡特权生效！今日畅玩已开启（免扣除余额），有效至次日早 06:00',
        })
      );
    }

    // 3. 非月卡用户：单日上机，扣除 day_price 余额，独立记录 mug_tcg_record，不修改 tcg_expire_date
    const currentBalance = freshUser.balance;
    if (Number(currentBalance) < dayPrice) {
      throw new AppError(`账户余额不足（当前 ¥${toMoney(currentBalance)}，开启今日畅玩需 ¥${dayPrice}），请先充值`);
    }

    const newBalance = subMoney(currentBalance, dayPrice);

    await updateUser(trx, user.id, {
      balance: newBalance,
    });

    await insertBalanceLog(trx, {
      user_id: user.id,
      change_amount: -toMoney(dayPrice),
      balance_after: newBalance,
      type: 3, // TCG
      remark: `开启今日TCG畅玩(扣除¥${dayPrice})`,
    });

    const sessionId = await insertTcgRecord(trx, {
      user_id: user.id,
      cost: dayPrice,
      is_monthly: 0,
      expire_time: sessionExpire,
    });

    return c.json(
      ok({
        already_active: false,
        deducted: dayPrice,
        is_monthly: false,
        session_id: sessionId,
        expire_time: sessionExpire,
        balance: toMoney(newBalance),
        message: `开启成功！已扣除余额 ¥${dayPrice}，今日畅玩已生效至次日早 06:00`,
      })
    );
  });
});

/**
 * POST /api/v1/tcg/passes/buy-monthly
 * 开通 / 续费 TCG 畅玩月卡：
 * - 纯粹累加用户的 tcg_expire_date (+30 天至 06:00:00)
 * - 扣除 month_price 余额并记账
 * - 若今天尚未上机，顺便免费激活今日上机会话
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
    const newExpire = calculateExpire(freshUser.tcg_expire_date, 30);

    // 1. 更新用户的月卡到期时间和余额
    await updateUser(trx, user.id, {
      balance: newBalance,
      tcg_expire_date: newExpire,
    });

    // 2. 写入财务日志
    await insertBalanceLog(trx, {
      user_id: user.id,
      change_amount: -toMoney(monthPrice),
      balance_after: newBalance,
      type: 3, // TCG
      remark: `开通/续费TCG畅玩月卡30天(扣除¥${monthPrice})`,
    });

    // 3. 若今日尚未开启上机，自动免费激活今日会话
    const activeSession = await findActiveTcgSession(trx, user.id);
    let sessionActivated = false;
    if (!activeSession) {
      const sessionExpire = calculateExpire(null, 1);
      await insertTcgRecord(trx, {
        user_id: user.id,
        cost: 0,
        is_monthly: 1,
        expire_time: sessionExpire,
      });
      sessionActivated = true;
    }

    const remainingDays = daysFromExpire(newExpire);

    return c.json(
      ok({
        deducted: monthPrice,
        balance: toMoney(newBalance),
        tcg_days: remainingDays,
        tcg_expire_date: newExpire,
        session_activated: sessionActivated,
        message: '月卡办理成功！未来 30 天内每日进店均免扣费',
      })
    );
  });
});
