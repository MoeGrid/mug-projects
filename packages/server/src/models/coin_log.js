// 街机投币记录数据访问层
import { tsNow } from '../utils/date.js';

/**
 * 写入投币记录
 */
export async function insertCoinLog(dbh, data) {
  const ts = tsNow();
  const res = await dbh
    .insertInto('mug_coin_log')
    .values({
      coin_num: 1,
      cost_amount: 0.00,
      pay_type: 1,
      channel: 1,
      status: 1,
      ...data,
      create_time: ts,
      update_time: ts,
    })
    .executeTakeFirstOrThrow();
  return Number(res.insertId);
}

/**
 * 关联设备与设备组
 */
export async function attachDeviceAndGroupToCoin(item, dbh) {
  if (!item.device_id) return { ...item, device: null };
  const device = await dbh
    .selectFrom('mug_device')
    .selectAll()
    .where('id', '=', item.device_id)
    .executeTakeFirst();
  if (!device) return { ...item, device: null };

  const group = await dbh
    .selectFrom('mug_device_group')
    .selectAll()
    .where('id', '=', device.group_id)
    .executeTakeFirst();

  return {
    ...item,
    device: {
      ...device,
      device_group: group || null,
    },
  };
}
