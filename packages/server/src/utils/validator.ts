import type {Context} from 'hono';
import {z} from 'zod';
import {AppError} from './responses.js';

/** 必填整数（兼容字符串数字，如 '5'）；失败给出中文提示 */
export const zInt = (label: string) =>
  z.coerce.number(`${label}必须是整数`).int(`${label}必须是整数`);

/** 必填数字（可含小数）；失败给出中文提示 */
export const zNum = (label: string) =>
  z.coerce.number(`${label}必须是数字`);

/** 0/1 标志位（前端 u-switch 传 0/1 数字） */
export const zFlag = (label: string) =>
  z.coerce.number(`${label}取值错误`).int(`${label}取值错误`).min(0, `${label}取值错误`).max(1, `${label}取值错误`);

/**
 * 用 schema 解析数据，失败抛 AppError（取第一条错误信息，与全局 onError → {code:0} 契约一致）。
 */
export function parse<T extends z.ZodType>(data: unknown, schema: T): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(r.error.issues[0]?.message ?? '参数错误');
  return r.data;
}

/**
 * 读取 JSON 请求体并用 schema 解析，返回带类型的结果。
 * 普通接口都是 POST JSON，直接 c.req.json()；上传接口自行调 c.req.formData()，不经此处。
 * 空/非法 JSON 兜底为 {}，由 schema 给出“xx不能为空”提示。
 */
export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown = {};
  try {
    raw = await c.req.json();
  } catch {
    raw = {};
  }
  return parse(raw, schema);
}
