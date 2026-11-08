// Order 模型（对应 app/model/Order.php）
import type {Insertable, Updateable} from 'kysely';
import type {MugOrderTable, OrderRow} from '../db/types.js';
import type {Q} from './user.js';
import {tsNow} from '../utils/date.js';

export type {OrderRow};

/** Order::create([...]) */
export async function createOrder(dbh: Q, data: Insertable<MugOrderTable>): Promise<number> {
  const ts = tsNow();
  const {insertId} = await dbh
    .insertInto('mug_order')
    .values({...data, create_time: ts, update_time: ts})
    .executeTakeFirstOrThrow();
  return Number(insertId);
}

/** Order::where('we_order_id', ...)->find() */
export async function findOrderByWeOrderId(dbh: Q, weOrderId: string): Promise<OrderRow | undefined> {
  return await dbh.selectFrom('mug_order').selectAll().where('we_order_id', '=', weOrderId).executeTakeFirst();
}

/** $order->save() 更新分支 */
export async function updateOrder(dbh: Q, id: number, data: Updateable<MugOrderTable>): Promise<void> {
  await dbh.updateTable('mug_order').set({...data, update_time: tsNow()}).where('id', '=', id).execute();
}
