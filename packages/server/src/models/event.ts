// Event / Setting 模型（对应 app/model/Event.php、Setting.php）
import {db} from '../db/client.js';
import type {EventRow} from '../db/types.js';

export type {EventRow};

/** Event::where([['start_time','<=',$now],['end_time','>=',$now]])->select() */
export async function listActiveEvents(now: string): Promise<EventRow[]> {
  return await db
    .selectFrom('mug_event')
    .selectAll()
    .where('start_time', '<=', now)
    .where('end_time', '>=', now)
    .execute();
}

/** Event::where([id + 时间区间])->find() */
export async function findActiveEvent(id: number, now: string): Promise<EventRow | undefined> {
  return await db
    .selectFrom('mug_event')
    .selectAll()
    .where('id', '=', id)
    .where('start_time', '<=', now)
    .where('end_time', '>=', now)
    .executeTakeFirst();
}

/** Setting::getSetting($key, $default) */
export async function getSetting(key: string, def: string | null = null): Promise<string | null> {
  const row = await db.selectFrom('mug_setting').where('key', '=', key).select('value').executeTakeFirst();
  return row ? row.value : def;
}
