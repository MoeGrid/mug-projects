// Device 数据访问
import { db } from '../db/client.js';

export async function findDevice(dbh, id) {
  return dbh.selectFrom('mug_device').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function listDevicesByGroup(dbh, groupId) {
  return dbh
    .selectFrom('mug_device')
    .selectAll()
    .where('group_id', '=', groupId)
    .orderBy('sort', 'asc')
    .execute();
}

export async function listGroupsWithDevices() {
  const groups = await db.selectFrom('mug_device_group').selectAll().orderBy('sort', 'asc').execute();
  return Promise.all(
    groups.map(async (g) => ({
      ...g,
      devices: await listDevicesByGroup(db, g.id),
    }))
  );
}

export async function attachDeviceAndGroup(log) {
  if (log.device_id === null) return { ...log, device: null };
  const device = await db.selectFrom('mug_device').selectAll().where('id', '=', log.device_id).executeTakeFirst();
  if (!device) return { ...log, device: null };
  const group = await db.selectFrom('mug_device_group').selectAll().where('id', '=', device.group_id).executeTakeFirst();
  return { ...log, device: { ...device, device_group: group ?? null } };
}
