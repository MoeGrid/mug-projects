// 卡牌专区领域路由（TCG）
import {Hono} from 'hono';
import {db} from '../../db/client.js';
import {userAuth} from '../../utils/middleware.js';
import {AppError, ok} from '../../utils/responses.js';
import {calculateExpire, daysFromExpire} from '../../utils/date.js';
import {subMoney, toMoney} from '../../utils/money.js';
import {findUser, updateUser} from '../../models/user.js';
import {insertBalanceLog} from '../../models/balance_log.js';
import {getJsonSetting} from '../../models/setting.js';
import {findActiveTcgSession, insertTcgRecord} from '../../models/tcg_record.js';

export const tcgRouter = new Hono();

tcgRouter.use('*', userAuth);

const currentUser = (c) => c.get('user');

/** 获取 TCG 专区价格配置（支持 setting 动态配置） */
async function getTcgPricing() {
  const setting = await getJsonSetting('tcg_pass_setting', {day_price: 15, month_price: 180});
  return {
    day_price: Number(setting?.day_price ?? 15),
    month_price: Number(setting?.month_price ?? 180),
  };
}

/**
 * GET /api/v1/tcg/passes/options
 * 获取 TCG 专区价格配置及当前用户今日入场与 TCG PASS 状态
 */
tcgRouter.get('/passes/options', async (c) => {
  const pricing = await getTcgPricing();
  const user = currentUser(c);
  const freshUser = await findUser(db, user.id);

  // 1. TCG PASS 状态：由 tcg_expire_date 决定 (有效天数 > 0)
  const passDays = daysFromExpire(freshUser?.tcg_expire_date);
  const hasPass = passDays > 0;

  // 2. 今日是否已入场：由 mug_tcg_record 入场记录表判定（expire_time > NOW()）
  const activeSession = await findActiveTcgSession(db, user.id);
  const isEntryToday = Boolean(activeSession);

  return c.json(
    ok({
      day_price: pricing.day_price,
      month_price: pricing.month_price,
      is_entry_today: isEntryToday,
      active_session: activeSession || null,
      has_tcg_pass: hasPass,
      tcg_days: passDays,
      tcg_expire_date: freshUser?.tcg_expire_date || null,
      balance: toMoney(freshUser?.balance || 0),
    })
  );
});

/**
 * POST /api/v1/tcg/entry
 * TCG 进店入场：
 * - 不修改用户的 tcg_expire_date，在 mug_tcg_record 中记录本次入场会话
 * - 自动结束时间统一定为次日早 06:00:00
 * - 若用户持有有效 TCG PASS：免扣入场费（0元），记录 is_monthly = 1
 * - 若用户无 PASS：扣除 day_price 单日入场费，记录 is_monthly = 0 并写余额账本
 */
tcgRouter.post('/entry', async (c) => {
  const user = currentUser(c);
  const pricing = await getTcgPricing();
  const dayPrice = pricing.day_price;

  return db.transaction().execute(async (trx) => {
    const freshUser = await findUser(trx, user.id);
    if (!freshUser) throw new AppError('用户不存在');

    // 1. 检查今日是否已完成入场
    const activeSession = await findActiveTcgSession(trx, user.id);
    if (activeSession) {
      return c.json(
        ok({
          already_active: true,
          deducted: 0,
          active_session: activeSession,
          message: '今日已完成入场！',
        })
      );
    }

    // 2. 检查用户是否持有有效 TCG PASS
    const passDays = daysFromExpire(freshUser.tcg_expire_date);
    const hasPass = passDays > 0;
    const sessionExpire = calculateExpire(null, 1); // 次日 06:00:00

    if (hasPass) {
      // TCG PASS 会员：免入场费进店
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
          is_pass_free: true,
          session_id: sessionId,
          expire_time: sessionExpire,
          balance: toMoney(freshUser.balance),
          message: '入场成功，欢迎进店！',
        })
      );
    }

    // 3. 普通非 PASS 用户：扣除单日入场费，独立记录 mug_tcg_record，不修改 tcg_expire_date
    const currentBalance = freshUser.balance;
    if (Number(currentBalance) < dayPrice) {
      throw new AppError(`账户余额不足以支付入场费，请先充值`, 400, {
        need_recharge: true,
        error_type: 'INSUFFICIENT_BALANCE',
        title: '账户余额不足',
      });
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
      remark: `TCG进店入场(扣除¥${dayPrice})`,
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
        is_pass_free: false,
        session_id: sessionId,
        expire_time: sessionExpire,
        balance: toMoney(newBalance),
        message: '入场成功，欢迎进店！',
      })
    );
  });
});


/**
 * POST /api/v1/tcg/passes/buy
 * 办理 / 续费 30 天 TCG PASS：
 * - 纯粹累加用户的 tcg_expire_date (+30 天至 06:00:00)
 * - 扣除 month_price 余额并记账
 */
tcgRouter.post('/passes/buy', async (c) => {
  const user = currentUser(c);
  const pricing = await getTcgPricing();
  const monthPrice = pricing.month_price;

  return db.transaction().execute(async (trx) => {
    const freshUser = await findUser(trx, user.id);
    if (!freshUser) throw new AppError('用户不存在');

    const currentBalance = freshUser.balance;
    if (Number(currentBalance) < monthPrice) {
      throw new AppError(`账户余额不足以办理 TCG PASS，请先充值`, 400, {
        need_recharge: true,
        error_type: 'INSUFFICIENT_BALANCE',
        title: '账户余额不足',
      });
    }

    const newBalance = subMoney(currentBalance, monthPrice);
    const newExpire = calculateExpire(freshUser.tcg_expire_date, 30);

    // 1. 更新用户的 TCG PASS 到期时间和余额
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
      remark: `开通/续费 TCG PASS 30天(扣除¥${monthPrice})`,
    });

    const remainingDays = daysFromExpire(newExpire);

    return c.json(
      ok({
        deducted: monthPrice,
        balance: toMoney(newBalance),
        tcg_days: remainingDays,
        tcg_expire_date: newExpire,
        message: 'TCG PASS 办理成功！',
      })
    );
  });
});


