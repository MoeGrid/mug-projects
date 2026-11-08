// 音游街机领域路由
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { insertCoin } from '../../services/mqtt.js';
import { userAuth } from '../../utils/middleware.js';
import { body, zInt } from '../../utils/validator.js';
import { AppError, ok } from '../../utils/responses.js';
import { daysFromExpire, tsNow } from '../../utils/date.js';
import { subMoney, toMoney } from '../../utils/money.js';
import { insertBalanceLog } from '../../models/balance_log.js';
import { attachDeviceAndGroupToCoin, insertCoinLog } from '../../models/coin_log.js';
import { findDevice, listGroupsWithDevices } from '../../models/device.js';
import { findUser } from '../../models/user.js';

export const arcadeRouter = new Hono();

arcadeRouter.use('*', userAuth);

const currentUser = (c) => c.get('user');

let msgIdSeq = 0;
function nextMsgId() {
  msgIdSeq = (msgIdSeq + 1) % 1000;
  return Date.now() * 1000 + msgIdSeq;
}

/**
 * 投币事务处理：彻底分离「投币记录」与「资金变动记录」
 * @param {object} trx 事务句柄
 * @param {object} trxUser 当前用户
 * @param {object} device 目标机台
 * @param {number} operatorId 操作者ID
 */
async function settleCoinInTrx(trx, trxUser, device, operatorId) {
  const days = daysFromExpire(trxUser.arcade_expire_date || trxUser.expire_date);
  const isFreePass = days > 0 && Boolean(device.can_use_days);

  if (isFreePass) {
    // 1. 通行证畅玩投币：记录投币履约，不发生资金流动，不写入财务流水表！
    await insertCoinLog(trx, {
      user_id: operatorId,
      device_id: device.id,
      coin_num: device.coin || 1,
      cost_amount: 0.00,
      pay_type: 2, // 畅玩免扣
      status: 1,
    });
  } else {
    // 2. 余额投币：扣减用户余额，产生投币记录，并联动写入资金账本
    const balance = subMoney(trxUser.balance, device.price);
    await trx
      .updateTable('mug_user')
      .set({ balance, update_time: tsNow() })
      .where('id', '=', trxUser.id)
      .execute();

    const coinLogId = await insertCoinLog(trx, {
      user_id: operatorId,
      device_id: device.id,
      coin_num: device.coin || 1,
      cost_amount: device.price,
      pay_type: 1, // 余额扣费
      status: 1,
    });

    await insertBalanceLog(trx, {
      user_id: operatorId,
      change_amount: -toMoney(device.price),
      balance_after: balance,
      type: 1, // 投币消费
      remark: `${device.name || '街机'} 投币消费`,
      related_id: `coin_${coinLogId}`,
    });
  }
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
 * GET /api/v1/arcade/coins/logs
 * 分页查询当前用户的街机投币记录（包含畅玩免扣与余额投币）
 */
arcadeRouter.get('/coins/logs', async (c) => {
  const rows = Math.max(parseInt(c.req.query('rows') || '20', 10), 1);
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const user = currentUser(c);

  const buildQuery = () =>
    db.selectFrom('mug_coin_log').where('user_id', '=', user.id);

  const totalRow = await buildQuery().select(({ fn }) => fn.countAll().as('cnt')).executeTakeFirst();
  const total = Number(totalRow?.cnt ?? 0);

  const logs = await buildQuery()
    .selectAll()
    .orderBy('create_time', 'desc')
    .limit(rows)
    .offset((page - 1) * rows)
    .execute();

  const data = await Promise.all(logs.map((item) => attachDeviceAndGroupToCoin(item, db)));

  return c.json(
    ok({
      total,
      per_page: rows,
      current_page: page,
      last_page: Math.max(Math.ceil(total / rows), 1),
      data,
    })
  );
});

/**
 * POST /api/v1/arcade/coins/remote-insert
 * 远程 MQTT 脉冲投币
 */
arcadeRouter.post('/coins/remote-insert', async (c) => {
  const { deviceId } = await body(c, z.object({ deviceId: zInt('deviceId') }));
  const operator = currentUser(c);
  const operatorId = operator.id;

  return db.transaction().execute(async (trx) => {
    const device = await findDevice(trx, deviceId);
    if (!device) throw new AppError('设备不存在!');

    const user = await findUser(trx, operatorId);
    if (!user) throw new AppError('用户不存在!');

    const days = daysFromExpire(user.arcade_expire_date || user.expire_date);
    if (toMoney(user.balance) < toMoney(device.price) && days <= 0) {
      throw new AppError('余额不足!');
    }

    const msgId = nextMsgId();
    let resp = null;
    try {
      resp = await insertCoin(device.client_id, { id: msgId, num: device.coin }, 5000);
    } catch {
      throw new AppError('网络开小差了，请重试');
    }

    if (!resp || resp.id !== msgId) {
      throw new AppError('出币超时，请重试');
    }
    if (resp.state !== 1) {
      throw new AppError('投币失败');
    }

    await settleCoinInTrx(trx, user, device, operatorId);

    return c.json(ok('投币成功'));
  });
});

/**
 * POST /api/v1/arcade/coins/ble-consume
 * 蓝牙投币上报结算
 */
arcadeRouter.post('/coins/ble-consume', async (c) => {
  const { deviceId } = await body(c, z.object({ deviceId: zInt('deviceId') }));
  const user = currentUser(c);

  return db.transaction().execute(async (trx) => {
    const freshUser = await findUser(trx, user.id);
    if (!freshUser) throw new AppError('用户不存在');

    const device = await findDevice(trx, deviceId);
    if (!device) throw new AppError('设备不存在');

    await settleCoinInTrx(trx, freshUser, device, user.id);

    return c.json(ok('投币已结算'));
  });
});
