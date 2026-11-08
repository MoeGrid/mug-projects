// Event / Setting 数据访问
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

export async function getSetting(key, def = null) {
  const row = await db.selectFrom('mug_setting').where('key', '=', key).select('value').executeTakeFirst();
  return row ? row.value : def;
}
