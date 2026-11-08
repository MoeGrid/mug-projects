// Zod 请求校验器
import { AppError } from './responses.js';

export function zInt(name) {
  return z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'number' ? v : parseInt(v, 10)))
    .refine((v) => Number.isInteger(v), { message: `${name}必须是整数` });
}

export function zNum(name) {
  return z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'number' ? v : parseFloat(v)))
    .refine((v) => !Number.isNaN(v), { message: `${name}必须是有效数值` });
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

import { z } from 'zod';

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
