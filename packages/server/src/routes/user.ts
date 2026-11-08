// 用户端路由（对应 route/app.php + app/controller/user/*）
// 除 /user/login 外全部走 UserAuth 中间件
import {Hono} from 'hono';
import {db} from '../db/client.js';
import type {DeviceRow, UserRow} from '../db/types.js';
import * as WeSdk from '../services/wechat.js';
import * as WePaySdk from '../services/wepay.js';
import {insertCoin} from '../services/mqtt.js';
import * as Snowflake from '../services/snowflake.js';
import {generateToken} from '../utils/auth.js';
import {userAuth} from '../utils/middleware.js';
import {body, zInt, zNum} from '../utils/validator.js';
import {z} from 'zod';
import {AppError, ok} from '../utils/responses.js';
import {fileExists, moveTmpToImage, putFile} from '../utils/storage.js';
import {daysFromExpire, now, tsNow} from '../utils/date.js';
import {addMoney, subMoney, toMoney} from '../utils/money.js';
import {findActiveEvent, getSetting, listActiveEvents} from '../models/event.js';
import {createOrder} from '../models/order.js';
import {insertBalanceLog} from '../models/balance_log.js';
import {attachDeviceAndGroup, findDevice, listGroupsWithDevices} from '../models/device.js';
import {findUser, findUserByOpenId, insertUser, type Q, toPublic, updateUser} from '../models/user.js';
import type {Env} from '../app.js';

export const userRouter = new Hono<Env>();

// ---------------------------------------------------------------------------
// 免登录：POST /user/login
// ---------------------------------------------------------------------------
userRouter.post('/user/login', async (c) => {
  const { code } = await body(c, z.object({code: z.string('code不能为空').min(1, 'code不能为空').max(255, 'code过长')}));
  // 请求微信服务器
  const res = await WeSdk.authCode2Session(code);
  // 保存登录 / 自动注册
  let user = await findUserByOpenId(db, res.openid);
  if (!user) {
    const id = await insertUser(db, {
      open_id: res.openid,
      session_key: res.session_key,
      nickname: '微信用户',
      is_admin: 0,
      is_ban: 0,
      balance: 0,
      expire_date: '1970-01-01',
    });
    user = await findUser(db, id);
  } else {
    await updateUser(db, user.id, {session_key: res.session_key});
  }
  if (!user) throw new AppError('用户创建失败');
  const data = toPublic(user) as Record<string, unknown>;
  data.token = await generateToken(user.id);
  // 锁定消息
  if (user.is_ban) data.ban_msg = await getSetting('user_lock_msg', '账号已被封禁！');
  return c.json(ok(data));
});

// ---------------------------------------------------------------------------
// 以下全部需要 UserAuth（仅限 /user/* 路径，避免误伤静态资源与其他路由）
// ---------------------------------------------------------------------------
userRouter.use('/user/*', userAuth);

const currentUser = (c: { get: (k: 'user') => UserRow }): UserRow => c.get('user');

// POST /user/info 用户信息
userRouter.post('/user/info', (c) => c.json(ok(toPublic(currentUser(c)))));

// POST /user/profile 完善资料
userRouter.post('/user/profile', async (c) => {
  const { avatar: rawAvatar, nickname } = await body(c, z.object({
    avatar: z.string('头像不能为空').min(1, '头像不能为空').max(255, '头像过长'),
    nickname: z.string('昵称不能为空').min(1, '昵称不能为空').max(255, '昵称过长'),
  }));
  const user = currentUser(c);
  // 转存头像
  let avatar = rawAvatar;
  if (avatar.startsWith('tmp')) {
    if (!(await fileExists(avatar))) throw new AppError('头像不存在');
    avatar = await moveTmpToImage(avatar);
  }
  await updateUser(db, user.id, {avatar, nickname});
  const fresh = await findUser(db, user.id);
  return c.json(ok(toPublic(fresh ?? {...user, avatar, nickname})));
});

// POST /user/phone 获取手机号
userRouter.post('/user/phone', async (c) => {
  const { code } = await body(c, z.object({code: z.string('code不能为空').min(1, 'code不能为空')}));
  const phone = await WeSdk.getPhone(code);
  return c.json(ok(phone));
});

// POST /user/available 查询币数
userRouter.post('/user/available', (c) => {
  const user = currentUser(c);
  return c.json(ok({
    balance: toMoney(user.balance),
    days: daysFromExpire(user.expire_date),
  }));
});

// 结算投币（对应 UserController::settleCoin，在事务内执行）
async function settleCoinInTrx(trx: Q, trxUser: UserRow, device: DeviceRow, operatorId: number) {
  const days = daysFromExpire(trxUser.expire_date);
  let num: number;
  let type: number;
  let balance = toMoney(trxUser.balance);
  if (days > 0 && Boolean(device.can_use_days)) {
    // 免费天数
    num = 0;
    type = 2;
  } else {
    // 投币
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

// POST /user/use BLE投币
userRouter.post('/user/use', async (c) => {
  const { id } = await body(c, z.object({id: zInt('id')}));
  const operatorId = currentUser(c).id;
  await db.transaction().execute(async (trx) => {
    const device = await findDevice(trx, id);
    if (!device) throw new AppError('设备不存在!');
    const user = await findUser(trx, operatorId);
    if (!user) throw new AppError('用户不存在!');
    await settleCoinInTrx(trx, user, device, operatorId);
  });
  return c.json(ok('投币成功'));
});

// 投币消息关联 ID：毫秒时间戳 * 1000 + 进程内自增序号（0~999），单调唯一且不丢精度，
// 只需在 insertCoin 的超时窗口内唯一即可，无需分布式全局唯一。
let msgIdSeq = 0;

function nextMsgId(): number {
  msgIdSeq = (msgIdSeq + 1) % 1000;
  return Date.now() * 1000 + msgIdSeq;
}

// POST /user/use2 MQTT投币
userRouter.post('/user/use2', async (c) => {
  const { id } = await body(c, z.object({id: zInt('id')}));
  const operatorId = currentUser(c).id;
  await db.transaction().execute(async (trx) => {
    // 查找设备和用户
    const device = await findDevice(trx, id);
    if (!device) throw new AppError('设备不存在!');
    const user = await findUser(trx, operatorId);
    if (!user) throw new AppError('用户不存在!');
    const days = daysFromExpire(user.expire_date);
    // 检查是否达到投币条件
    if (toMoney(user.balance) < toMoney(device.price) && days <= 0) throw new AppError('余额不足!');
    // 直连 MQTT 发布投币指令并等待回执（不再预检查在线，5s 无回执即超时）
    const msgId = nextMsgId();
    let resp: { code: number } | null;
    try {
      resp = await insertCoin(device.client_id, {id: msgId, num: device.coin}, 5000);
    } catch {
      throw new AppError('投币失败! 请联系管理员!'); // 发布失败/未连接
    }
    if (!resp) throw new AppError('设备不在线或投币超时!'); // 5s 无回执
    switch (resp.code) {
      case 1: // 投币成功
        await settleCoinInTrx(trx, user, device, operatorId);
        break;
      case 2: // 设备当前不能投币
        throw new AppError('设备当前不能投币!');
      case 3: // 投币失败未知原因
        throw new AppError('投币失败! 未知原因!');
      default:
        throw new AppError('投币失败! 响应错误!');
    }
  });
  return c.json(ok('投币成功'));
});

// POST /device/list1 获得设备
userRouter.post('/device/list1', async (c) => {
  const data = await listGroupsWithDevices();
  return c.json(ok(data));
});

// POST /buy/recharge 购买币
userRouter.post('/buy/recharge', async (c) => {
  const { number } = await body(c, z.object({number: zNum('金额')}));
  const user = currentUser(c);
  // 计算金额（round(x, 2, PHP_ROUND_HALF_UP)）
  const amount = roundHalfUp(number, 2);
  // 订单号
  const weOrderId = Snowflake.generate();
  // 创建系统订单
  await createOrder(db, {
    user_id: user.id,
    num: amount,
    amount,
    we_order_id: weOrderId,
    status: 0,
    type: 1,
  });
  // 统一下单
  const prepayId = await WePaySdk.createOrder({
    description: '衡水MUG-购买游戏币',
    out_trade_no: weOrderId,
    amount: {
      total: Math.trunc(amount * 100),
      currency: 'CNY',
    },
    payer: {
      openid: user.open_id,
    },
  });
  return c.json(ok(WePaySdk.paySign(prepayId)));
});

// POST /buy/event 购买活动
userRouter.post('/buy/event', async (c) => {
  const { id } = await body(c, z.object({id: zInt('id')}));
  const user = currentUser(c);
  const event = await findActiveEvent(id, now());
  if (!event) throw new AppError('活动不存在!');
  // 订单号
  const weOrderId = Snowflake.generate();
  // 创建系统订单
  await createOrder(db, {
    user_id: user.id,
    num: event.num,
    amount: event.amount,
    we_order_id: weOrderId,
    status: 0,
    type: 1,
  });
  // 统一下单
  const prepayId = await WePaySdk.createOrder({
    description: '衡水MUG-购买游戏币',
    out_trade_no: weOrderId,
    amount: {
      total: Math.trunc(event.amount * 100),
      currency: 'CNY',
    },
    payer: {
      openid: user.open_id,
    },
  });
  return c.json(ok(WePaySdk.paySign(prepayId)));
});

// POST /event/list 活动列表
userRouter.post('/event/list', async (c) => {
  const data = await listActiveEvents(now());
  return c.json(ok(data));
});

// POST /balanceLog/list 余额记录
userRouter.post('/balanceLog/list', async (c) => {
  const { rows, page: rawPage } = await body(c, z.object({
    rows: zInt('条数').default(20),
    page: zInt('页码').default(1),
  }));
  const user = currentUser(c);
  const page = Math.max(rawPage, 1);
  const buildQuery = () => db
    .selectFrom('mug_balance_log')
    .where('user_id', '=', user.id)
    .where('create_time', '>', '2023-05-18 11:00:00');
  const totalRow = await buildQuery().select(({fn}) => fn.countAll<number>().as('cnt')).executeTakeFirst();
  const total = Number(totalRow?.cnt ?? 0);
  const logs = await buildQuery()
    .selectAll()
    .orderBy('create_time', 'desc')
    .limit(rows)
    .offset((page - 1) * rows)
    .execute();
  // with(['device.device_group'])
  const data = await Promise.all(logs.map(attachDeviceAndGroup));
  return c.json(ok({
    total,
    per_page: rows,
    current_page: page,
    last_page: Math.max(Math.ceil(total / rows), 1),
    data,
  }));
});

// POST /upload/image 上传
userRouter.post('/upload/image', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new AppError('参数错误');
  }
  const file = form.get('image');
  if (!(file instanceof File)) throw new AppError('参数错误');
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'gif'].includes(ext)) throw new AppError('文件格式错误');
  if (file.size > 100 * 1024 * 1024) throw new AppError('文件大小超出限制');
  const data = Buffer.from(await file.arrayBuffer());
  const savedPath = await putFile('tmp', data, ext);
  return c.json(ok(savedPath));
});

/** round(x, 2, PHP_ROUND_HALF_UP) */
function roundHalfUp(x: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(x * p) / p;
}
