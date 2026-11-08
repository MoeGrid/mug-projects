// BalanceLog 数据访问
import { tsNow } from '../utils/date.js';

export async function insertBalanceLog(dbh, data) {
  const ts = tsNow();
  const { insertId } = await dbh
    .insertInto('mug_balance_log')
    .values({ ...data, create_time: ts, update_time: ts })
    .executeTakeFirstOrThrow();
  return Number(insertId);
}
