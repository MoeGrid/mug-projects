// 卡牌专区领域路由（TCG）
import { Hono } from 'hono';
import { userAuth } from '../../utils/middleware.js';
import { ok } from '../../utils/responses.js';

export const tcgRouter = new Hono();

tcgRouter.use('*', userAuth);

/**
 * GET /api/v1/tcg/passes/options
 * 获取 TCG 卡牌通行证套餐配置
 */
tcgRouter.get('/passes/options', (c) => {
  return c.json(
    ok([
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
    ])
  );
});

/**
 * GET /api/v1/tcg/events
 * 获取近期 TCG 赛事与活动列表
 */
tcgRouter.get('/events', (c) => {
  return c.json(ok([]));
});
