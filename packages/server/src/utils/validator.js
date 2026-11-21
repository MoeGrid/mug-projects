// Zod 请求校验器
import { z } from 'zod';
import { AppError } from './responses.js';

// 说明：Zod v4 里 union()/transform()/refine() 返回的是 ZodPipe/ZodEffects，
// 不再是 ZodNumber，因此没有 .int()/.min()/.max() 等数值方法。
// 这里统一用 z.coerce.number() 生成真正的 ZodNumber：
// 依旧接受「数字或数字字符串」，同时保证返回值可以继续链式调用数值校验。
export function zInt(name) {
  return z
    .coerce.number({ error: `${name}必须是整数` })
    .int(`${name}必须是整数`);
}

export function zNum(name) {
  return z.coerce.number({ error: `${name}必须是有效数值` });
}

export function zFlag(name) {
  return z
    .union([z.boolean(), z.number(), z.string()])
    .transform((v) => {
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'number') return v ? 1 : 0;
      return v === '1' || v.toLowerCase() === 'true' ? 1 : 0;
    });
}

export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const first = r.error.issues[0];
  throw new AppError(first?.message ?? '参数错误');
}

export async function body(c, schema) {
  let raw;
  try {
    raw = await c.req.json();
  } catch {
    throw new AppError('请求体必须是有效的 JSON 格式');
  }
  return parse(schema, raw);
}
