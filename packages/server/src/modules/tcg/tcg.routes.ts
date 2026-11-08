// 卡牌专区模块（TCG - Trading Card Game）
import {Hono} from 'hono';
import {z} from 'zod';
import {userAuth} from '../../utils/middleware.js';
import {body} from '../../utils/validator.js';
import {ok} from '../../utils/responses.js';
import type {Env} from '../../app.js';

export const tcgRouter = new Hono<Env>();

tcgRouter.use('*', userAuth);

/**
 * GET /api/v1/tcg/passes/options
 * 获取 TCG 卡牌通行证套餐配置
 */
tcgRouter.get('/passes/options', (c) => {
  return c.json(ok([
    {
      id: 'day',
      name: 'TCG 单日通行证',
      price: 15,
      days: 1,
      badge: '今日畅玩',
      desc: '当日不限时畅玩卡牌专区与桌游',
    },
    {
      id: 'month',
      name: 'TCG 30天全月通行证',
      price: 180,
      days: 30,
      badge: '超值推荐',
      desc: '连续 30 天无限次畅玩，专属身份勋章',
    },
  ]));
});

/**
 * GET /api/v1/tcg/events
 * 获取近期 TCG 卡牌赛事与桌游专场活动
 */
tcgRouter.get('/events', (c) => {
  return c.json(ok([]));
});
