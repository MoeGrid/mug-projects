// 管理端路由（对应 route/admin.php + app/controller/admin/UserController.php）
import {Hono} from 'hono';
import {db} from '../db/client.js';
import {adminAuth} from '../utils/middleware.js';
import {body, zFlag, zInt, zNum} from '../utils/validator.js';
import {z} from 'zod';
import {AppError, ok} from '../utils/responses.js';
import {dateOffsetDays, tsNow} from '../utils/date.js';
import {addMoney, toMoney} from '../utils/money.js';
import {insertBalanceLog} from '../models/balance_log.js';
import {findUser, type Q, toPublic, updateUser, withDays} from '../models/user.js';
import type {Env} from '../app.js';

export const adminUserRouter = new Hono<Env>();

adminUserRouter.use('*', adminAuth);

// POST /admin/user/info 用户信息
adminUserRouter.post('/admin/user/info', async (c) => {
  const { id } = await body(c, z.object({id: zInt('id')}));
  const user = await findUser(db, id);
  if (!user) throw new AppError('用户不存在!');
  // $user->append(['days'])
  return c.json(ok(withDays(user)));
});

// POST /admin/user/search 用户搜索（分页）
adminUserRouter.post('/admin/user/search', async (c) => {
  const { keyword, rows, page: rawPage } = await body(c, z.object({
    keyword: z.string().max(255, '关键词过长').nullish(),
    rows: zInt('条数').default(20),
    page: zInt('页码').default(1),
  }));
  const page = Math.max(rawPage, 1);
  const buildQuery = () => {
    let q = db.selectFrom('mug_user');
    if (keyword) {
      const kw = `%${keyword}%`;
      const isId = /^\d+$/.test(keyword);
      // 文本列模糊匹配；纯数字关键词额外加 id 精确匹配，二者为 or 关系（101 能查出 id=101 或 nickname 含 101）
      q = q.where((eb) => {
        const conds = [eb('nickname', 'like', kw), eb('qq', 'like', kw), eb('remark', 'like', kw)];
        if (isId) conds.unshift(eb('id', '=', Number(keyword)));
        return eb.or(conds);
      });
    }
    return q;
  };
  const totalRow = await buildQuery().select(({fn}) => fn.countAll<number>().as('cnt')).executeTakeFirst();
  const total = Number(totalRow?.cnt ?? 0);
  const data = await buildQuery()
    .selectAll()
    .orderBy('is_admin', 'desc')
    .orderBy('id', 'asc')
    .limit(rows)
    .offset((page - 1) * rows)
    .execute();
  return c.json(ok({
    total,
    per_page: rows,
    current_page: page,
    last_page: Math.max(Math.ceil(total / rows), 1),
    data: data.map(toPublic),
  }));
});

// POST /admin/user/modify 修改资料
adminUserRouter.post('/admin/user/modify', async (c) => {
  const { id, ...data } = await body(c, z.object({
    id: zInt('id'),
    qq: z.string().max(255, 'qq过长').nullish(),
    phone: z.string().max(255, '手机号过长').nullish(),
    remark: z.string().max(255, '备注过长').nullish(),
    is_admin: zFlag('is_admin'),
    is_ban: zFlag('is_ban'),
  }));
  const user = await findUser(db, id);
  if (!user) throw new AppError('用户不存在!');
  await updateUser(db, id, data);
  return c.json(ok('保存成功'));
});

// POST /admin/user/rechange 后台充值（1加币 2加时间）
adminUserRouter.post('/admin/user/rechange', async (c) => {
  const { id, type, num } = await body(c, z
    .object({
      id: zInt('id'),
      type: zInt('type'),
      num: zNum('数量'),
    })
    .superRefine((v, ctx) => {
      if (v.type !== 1 && v.type !== 2) ctx.addIssue({ code: 'custom', message: '类型取值错误', path: ['type'] });
      // num 依据 type：1=加币（可小数） 2=加天数（必须整数）
      if (v.type === 2 && !Number.isInteger(v.num)) ctx.addIssue({ code: 'custom', message: '数量必须是整数', path: ['num'] });
    }));
  await db.transaction().execute(async (trx: Q) => {
    const user = await findUser(trx, id);
    if (!user) throw new AppError('用户不存在!');
    if (type === 1) {
      // 变动余额（高精度加法，防止字符串拼接与浮点数精度丢失）
      const balance = Math.max(addMoney(user.balance, num), 0);
      await trx.updateTable('mug_user').set({balance, update_time: tsNow()}).where('id', '=', user.id).execute();
      // 记录
      await insertBalanceLog(trx, {
        user_id: user.id,
        balance,
        num: toMoney(num),
        type: 4,
      });
    } else if (type === 2) {
      // 等价 date('Y-m-d', strtotime(($num-1<0?'-':'+').abs($num-1).' day', strtotime(date('Y-m-d'))))
      const expireDate = dateOffsetDays(num - 1);
      await trx.updateTable('mug_user').set({
        expire_date: expireDate,
        update_time: tsNow()
      }).where('id', '=', user.id).execute();
    }
  });
  return c.json(ok('保存成功'));
});
