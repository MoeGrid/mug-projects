// TCG 上机/畅玩记录数据访问
import { tsNow, dateTimeStr } from '../utils/date.js';

/**
 * 查询用户当前是否在上机有效期内（自动下机时间未到）
 * @param {object} dbh 数据库实例或事务
 * @param {number} userId 用户ID
 * @returns {Promise<object|undefined>} 最新的有效上机记录
 */
export async function findActiveTcgSession(dbh, userId) {
  const now = dateTimeStr();
  return dbh
    .selectFrom('mug_tcg_record')
    .selectAll()
    .where('user_id', '=', userId)
    .where('expire_time', '>', now)
    .orderBy('id', 'desc')
    .executeTakeFirst();
}

/**
 * 插入一条 TCG 上机/畅玩记录
 * @param {object} dbh 数据库实例或事务
 * @param {object} data
 * @param {number} data.user_id 用户ID
 * @param {number|string} data.cost 扣费金额(月卡为0)
 * @param {number} [data.is_monthly=0] 是否月卡免扣费上机
 * @param {string} data.expire_time 自动截止时间(次日06:00:00)
 * @returns {Promise<number>} 插入记录的ID
 */
export async function insertTcgRecord(dbh, data) {
  const ts = tsNow();
  const payload = {
    user_id: data.user_id,
    cost: data.cost ?? 0,
    is_monthly: data.is_monthly ? 1 : 0,
    expire_time: data.expire_time,
    create_time: ts,
  };

  const { insertId } = await dbh
    .insertInto('mug_tcg_record')
    .values(payload)
    .executeTakeFirstOrThrow();
  return Number(insertId);
}
