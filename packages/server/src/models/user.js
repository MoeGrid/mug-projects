// User 数据访问
import { daysFromExpire, daysFromTcgExpire, tsNow } from '../utils/date.js';

export function withDays(user) {
  const arcadeDays = daysFromExpire(user.arcade_expire_date || user.expire_date);
  const tcgDays = daysFromExpire(user.tcg_expire_date);
  return {
    ...user,
    days: arcadeDays,
    arcade_days: arcadeDays,
    tcg_days: tcgDays,
  };
}

export function toPublic(user) {
  const src = { ...user };
  delete src.session_key;
  delete src.open_id;
  return src;
}

export async function findUser(dbh, id) {
  return dbh.selectFrom('mug_user').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findUserByOpenId(dbh, openId) {
  return dbh.selectFrom('mug_user').selectAll().where('open_id', '=', openId).executeTakeFirst();
}

export async function insertUser(dbh, data) {
  const ts = tsNow();
  const { insertId } = await dbh
    .insertInto('mug_user')
    .values({ ...data, create_time: ts, update_time: ts })
    .executeTakeFirstOrThrow();
  return Number(insertId);
}

export async function updateUser(dbh, id, data) {
  await dbh
    .updateTable('mug_user')
    .set({ ...data, update_time: tsNow() })
    .where('id', '=', id)
    .execute();
}
