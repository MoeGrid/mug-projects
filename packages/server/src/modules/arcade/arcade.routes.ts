// 音游街机投币模块（Arcade）
import {Hono} from 'hono';
import {z} from 'zod';
import {db} from '../../db/client.js';
import type {DeviceRow, UserRow} from '../../db/types.js';
import {insertCoin} from '../../services/mqtt.js';
import {userAuth} from '../../utils/middleware.js';
import {body, zInt} from '../../utils/validator.js';
import {AppError, ok} from '../../utils/responses.js';
import {daysFromExpire, tsNow} from '../../utils/date.js';
import {subMoney, toMoney} from '../../utils/money.js';
import {insertBalanceLog} from '../../models/balance_log.js';
import {findDevice, listGroupsWithDevices} from '../../models/device.js';
import {findUser, type Q} from '../../models/user.js';
import type {Env} from '../../app.js';

export const arcadeRouter = new Hono<Env>();

arcadeRouter.use('*', userAuth);

const currentUser = (c: { get: (k: 'user') => any }) => c.get('user');

// 投币消息关联 ID：毫秒时间戳 * 1000 + 进程内序号
let msgIdSeq = 0;
function nextMsgId(): number {
  msgIdSeq = (msgIdSeq + 1) % 1000;
  return Date.now() * 1000 + msgIdSeq;
}

/**
 * 事务内投币结算与流水记账
 */
async function settleCoinInTrx(trx: Q, trxUser: UserRow, device: DeviceRow, operatorId: number) {
  const days = daysFromExpire(trxUser.expire_date);
  let num: number;
  let type: number;
  let balance = toMoney(trxUser.balance);

  if (days > 0 && Boolean(device.can_use_days)) {
    // 通玩特权免扣款
    num = 0;
    type = 2;
  } else {
    // 正常扣除余额
    balance = subMoney(trxUser.balance, device.price);
    await trx.updateTable('mug_user').set({balance, update_time: tsNow()}).where('id', '=', trxUser.id).execute();
    num = -toMoney(device.price);
    type = 1;
  }

  await insertBalanceLog(trx, {
    num,
    type,
    device_id: device.id,
    user_id: operatorId,
    balance,
  });
}

/**
 * GET /api/v1/arcade/devices
 * 获取全部街机设备分组与机台状态列表
 */
arcadeRouter.get('/devices', async (c) => {
  const groups = await listGroupsWithDevices();
  return c.json(ok(groups));
});

/**
 * POST /api/v1/arcade/coins/remote-insert
 * 远程 MQTT 脉冲投币：直连机台投币器并完成账户扣费
 */
arcadeRouter.post('/coins/remote-insert', async (c) => {
  const { deviceId } = await body(c, z.object({
    deviceId: zInt('设备ID'),
  }));
  const operatorId = currentUser(c).id;

  await db.transaction().execute(async (trx) => {
    const device = await findDevice(trx, deviceId);
    if (!device) throw new AppError('设备不存在!');

    const user = await findUser(trx, operatorId);
    if (!user) throw new AppError('用户不存在!');

    const days = daysFromExpire(user.expire_date);
    if (toMoney(user.balance) < toMoney(device.price) && days <= 0) {
      throw new AppError('余额不足!');
    }

    const msgId = nextMsgId();
    let resp: { code: number } | null;
    try {
      resp = await insertCoin(device.client_id, {id: msgId, num: device.coin}, 5000);
    } catch {
      throw new AppError('投币失败! 请联系管理员!');
    }

    if (!resp || resp.code !== 1) {
      throw new AppError('投币无响应! 请稍后重试!');
    }

    await settleCoinInTrx(trx, user, device, operatorId);
  });

  return c.json(ok('投币成功'));
});

/**
 * POST /api/v1/arcade/coins/ble-consume
 * BLE 蓝牙直连投币上报结算
 */
arcadeRouter.post('/coins/ble-consume', async (c) => {
  const { deviceId } = await body(c, z.object({
    deviceId: zInt('设备ID'),
  }));
  const operatorId = currentUser(c).id;

  await db.transaction().execute(async (trx) => {
    const device = await findDevice(trx, deviceId);
    if (!device) throw new AppError('设备不存在!');

    const user = await findUser(trx, operatorId);
    if (!user) throw new AppError('用户不存在!');

    await settleCoinInTrx(trx, user, device, operatorId);
  });

  return c.json(ok('投币成功'));
});
