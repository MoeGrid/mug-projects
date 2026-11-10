// Setting 数据访问
import { db } from '../db/client.js';

export async function getSetting(key, def = null) {
  const row = await db.selectFrom('mug_setting').where('key', '=', key).select('value').executeTakeFirst();
  return row ? row.value : def;
}

export async function getJsonSetting(key, def = null) {
  const val = await getSetting(key, null);
  if (!val) return def;
  try {
    return JSON.parse(val);
  } catch (e) {
    return def;
  }
}

export async function setSetting(key, value, remark = null) {
  const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
  await db
    .insertInto('mug_setting')
    .values({
      key,
      value: valStr,
      remark: remark || undefined,
    })
    .onDuplicateKeyUpdate({
      value: valStr,
      ...(remark ? { remark } : {}),
    })
    .execute();
}
