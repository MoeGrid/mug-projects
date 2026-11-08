// Device / DeviceGroup 模型（对应 app/model/Device.php、DeviceGroup.php）
import {db} from '../db/client.js';
import type {DeviceRow, MugDeviceTable} from '../db/types.js';
import type {Updateable} from 'kysely';
import type {Q} from './user.js';
import {tsNow} from '../utils/date.js';

export type {DeviceRow};

/** Device::find($id) */
export async function findDevice(dbh: Q, id: number): Promise<DeviceRow | undefined> {
  return await dbh.selectFrom('mug_device').selectAll().where('id', '=', id).executeTakeFirst();
}

/** Device::order('sort')->where('group_id', $gid)->select() */
export async function listDevicesByGroup(dbh: Q, groupId: number): Promise<DeviceRow[]> {
  return await dbh.selectFrom('mug_device').selectAll().where('group_id', '=', groupId).orderBy('sort', 'asc').execute();
}

/** DeviceGroup::order('sort')->select() + 每组挂载 devices（user.Device/list1） */
export async function listGroupsWithDevices() {
  const groups = await db.selectFrom('mug_device_group').selectAll().orderBy('sort', 'asc').execute();
  return Promise.all(groups.map(async (g) => ({
    ...g,
    devices: await listDevicesByGroup(db, g.id),
  })));
}

/** BalanceLog 的 with(['device.device_group']) 关联：给日志行附加 device（含 device_group） */
export async function attachDeviceAndGroup<T extends { device_id: number | null }>(log: T) {
  if (log.device_id === null) return {...log, device: null};
  const device = await db.selectFrom('mug_device').selectAll().where('id', '=', log.device_id).executeTakeFirst();
  if (!device) return {...log, device: null};
  const group = await db.selectFrom('mug_device_group').selectAll().where('id', '=', device.group_id).executeTakeFirst();
  return {...log, device: {...device, device_group: group ?? null}};
}

/** $device->save() 更新分支 */
export async function updateDevice(dbh: Q, id: number, data: Updateable<MugDeviceTable>): Promise<void> {
  await dbh.updateTable('mug_device').set({...data, update_time: tsNow()}).where('id', '=', id).execute();
}
