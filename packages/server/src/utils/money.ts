// 金额与游戏币精度安全计算工具
// JavaScript 浮点数存在 0.1 + 0.2 = 0.30000000000000004 精度丢失问题；
// 且 MySQL DECIMAL 驱动返回为字符串，直接用 + 会发生字符串拼接错误。
// 这里统一转换为整数「分」（* 100）进行整数运算，确保 100% 精确无误差。

/**
 * 元/币转分（整数）
 */
export function toCents(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * 分转元/币（保留最多两位小数的 number）
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * 安全加法：a + b
 */
export function addMoney(a: number | string | null | undefined, b: number | string | null | undefined): number {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * 安全减法：a - b
 */
export function subMoney(a: number | string | null | undefined, b: number | string | null | undefined): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * 安全数值转换（保证返回标准的 number）
 */
export function toMoney(val: number | string | null | undefined): number {
  return fromCents(toCents(val));
}
