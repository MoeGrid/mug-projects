// User 模型（对应老项目 app/model/User.php）
// ThinkPHP 的 Model 静态方法在这里改为函数 + Kysely 查询；dbh 参数用于事务场景
import type {Insertable, Kysely, Transaction, Updateable} from 'kysely';
import type {Database, MugUserTable, UserRow} from '../db/types.js';
import {daysFromExpire, tsNow} from '../utils/date.js';

export type {UserRow};
export type UserWithDays = UserRow & { days: number };

export type Q = Kysely<Database> | Transaction<Database>;

/** 附加 days 计算属性（等价 $user->append(['days']) / $user->days） */
export function withDays(user: UserRow): UserWithDays {
  return {...user, days: daysFromExpire(user.expire_date)};
}

/**
 * 输出给前端的用户数据（hidden = ['session_key', 'open_id']，对应老模型 JSON 序列化行为）。
 * token 在原项目里并非数据库映射字段（登录时只是附加到响应），由调用方自行加。
 */
export function toPublic(user: UserRow | UserWithDays): Record<string, unknown> {
  const src: Record<string, unknown> = {...user} as Record<string, unknown>;
  delete src.session_key;
  delete src.open_id;
  return src;
}

/** User::find($id) */
export async function findUser(dbh: Q, id: number): Promise<UserRow | undefined> {
  return await dbh.selectFrom('mug_user').selectAll().where('id', '=', id).executeTakeFirst();
}

/** User::where('open_id', ...)->find() */
export async function findUserByOpenId(dbh: Q, openId: string): Promise<UserRow | undefined> {
  return await dbh.selectFrom('mug_user').selectAll().where('open_id', '=', openId).executeTakeFirst();
}

/** $user->save() 新增分支（create_time/update_time 自动写入，等价 autoWriteTimestamp） */
export async function insertUser(dbh: Q, data: Insertable<MugUserTable>): Promise<number> {
  const ts = tsNow();
  const {insertId} = await dbh
    .insertInto('mug_user')
    .values({...data, create_time: ts, update_time: ts})
    .executeTakeFirstOrThrow();
  return Number(insertId);
}

/** $user->save() 更新分支：按 id 更新给定字段 */
export async function updateUser(dbh: Q, id: number, data: Updateable<MugUserTable>): Promise<void> {
  await dbh
    .updateTable('mug_user')
    .set({...data, update_time: tsNow()})
    .where('id', '=', id)
    .execute();
}
