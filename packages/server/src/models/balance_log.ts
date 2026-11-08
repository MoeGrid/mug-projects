// BalanceLog 模型（对应 app/model/BalanceLog.php）
import type {Insertable} from 'kysely';
import type {MugBalanceLogTable} from '../db/types.js';
import type {Q} from './user.js';
import {tsNow} from '../utils/date.js';

/** $cl->save()（新增记录，create_time/update_time 自动写入） */
export async function insertBalanceLog(dbh: Q, data: Insertable<MugBalanceLogTable>): Promise<number> {
  const ts = tsNow();
  const {insertId} = await dbh
    .insertInto('mug_balance_log')
    .values({...data, create_time: ts, update_time: ts})
    .executeTakeFirstOrThrow();
  return Number(insertId);
}
