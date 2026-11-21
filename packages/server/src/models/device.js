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

