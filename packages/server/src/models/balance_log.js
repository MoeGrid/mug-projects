// 钱包财务流水数据访问
import { tsNow } from '../utils/date.js';

/**
 * 写入资金流水（纯净财务变动账本）
 * 自动填充新字段与兼容旧字段
 */
export async function insertBalanceLog(dbh, data) {
  const ts = tsNow();
  const changeAmount = data.change_amount !== undefined ? data.change_amount : (data.num ?? 0);
  const balanceAfter = data.balance_after !== undefined ? data.balance_after : (data.balance ?? 0);
  const type = data.type !== undefined ? data.type : (data.biz_type ?? 1);

  const payload = {
    user_id: data.user_id,
    change_amount: changeAmount,
    balance_after: balanceAfter,
    type,
    remark: data.remark || '账户资金变动',
    related_id: data.related_id ? String(data.related_id) : null,
    // 兼容历史老字段
    num: changeAmount,
    balance: balanceAfter,
    create_time: ts,
    update_time: ts,
  };

  const { insertId } = await dbh
    .insertInto('mug_balance_log')
    .values(payload)
    .executeTakeFirstOrThrow();
  return Number(insertId);
}
