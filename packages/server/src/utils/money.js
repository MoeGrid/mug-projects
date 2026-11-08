// 金额与游戏币精度安全计算工具
// 使用整型「分」（* 100）进行整数计算，彻底杜绝浮点数精度丢失与字符串拼接。

export function toCents(val) {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function fromCents(cents) {
  return cents / 100;
}

export function addMoney(a, b) {
  return fromCents(toCents(a) + toCents(b));
}

export function subMoney(a, b) {
  return fromCents(toCents(a) - toCents(b));
}

export function toMoney(val) {
  return fromCents(toCents(val));
}
