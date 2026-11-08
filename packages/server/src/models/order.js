// Order 数据访问
import { tsNow } from '../utils/date.js';

export async function createOrder(dbh, data) {
  const ts = tsNow();
  const { insertId } = await dbh
    .insertInto('mug_order')
    .values({ ...data, create_time: ts, update_time: ts })
    .executeTakeFirstOrThrow();
  return Number(insertId);
}

export async function findOrderByWeOrderId(dbh, weOrderId) {
  return dbh.selectFrom('mug_order').selectAll().where('we_order_id', '=', weOrderId).executeTakeFirst();
}

export async function updateOrder(dbh, id, data) {
  await dbh
    .updateTable('mug_order')
    .set({ ...data, update_time: tsNow() })
    .where('id', '=', id)
    .execute();
}
