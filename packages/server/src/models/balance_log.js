// 钱包财务流水数据访问
import { tsNow } from '../utils/date.js';

/**
 * 写入资金流水（纯净财务变动账本）
 * @param {object} dbh 数据库实例或事务
 * @param {object} data
 * @param {number} data.user_id 用户ID
 * @param {number|string} data.change_amount 变动金额(+/-)
 * @param {number|string} data.balance_after 变动后结余
 * @param {number} data.type 1投币 2充值 3TCG PASS 4管理员调配
 * @param {string} data.remark 摘要说明
 */
export async function insertBalanceLog(dbh, data) {
  const ts = tsNow();
  const payload = {
    user_id: data.user_id,
    change_amount: data.change_amount,
    balance_after: data.balance_after,
    type: data.type,
    remark: data.remark || '账户资金变动',
    create_time: ts,
    update_time: ts,
  };

  const { insertId } = await dbh
    .insertInto('mug_balance_log')
    .values(payload)
    .executeTakeFirstOrThrow();
  return Number(insertId);
}
