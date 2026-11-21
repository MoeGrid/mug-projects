// Event 数据访问；Setting 相关请直接从 ./setting.js 引入
import { db } from '../db/client.js';

export async function listActiveEvents(now) {
  return db
    .selectFrom('mug_event')
    .selectAll()
    .where('start_time', '<=', now)
    .where('end_time', '>=', now)
    .execute();
}

export async function findActiveEvent(id, now) {
  return db
    .selectFrom('mug_event')
    .selectAll()
    .where('id', '=', id)
    .where('start_time', '<=', now)
    .where('end_time', '>=', now)
    .executeTakeFirst();
}

