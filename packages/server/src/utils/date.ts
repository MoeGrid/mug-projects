// 日期工具（对应老项目 common.php 的日期常量，ThinkPHP 时间均为北京时间字符串）
// 用 dayjs（utc + timezone 插件）处理固定的 Asia/Shanghai（UTC+8，无夏令时），
// 取代原手写的偏移补零逻辑；对外导出签名语义与原实现一致。
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

/** PHP date('Y-m-d') —— 北京时间 */
export function dateStr(d: Date = new Date()): string {
  return dayjs(d).tz(TZ).format('YYYY-MM-DD');
}

/** PHP date('Y-m-d H:i:s') —— 北京时间 */
export function dateTimeStr(d: Date = new Date()): string {
  return dayjs(d).tz(TZ).format('YYYY-MM-DD HH:mm:ss');
}

/** PHP strtotime('Y-m-d' | 'Y-m-d H:i:s') —— 按北京时间解析为 epoch 毫秒 */
export function parseDate(dateStr: string): number {
  // 归一化：去掉 ISO 分隔符 'T' 与时区后缀（Z / ±HH:MM），按北京时间墙钟解析，
  // 与原 PHP strtotime 语义一致（原实现即忽略偏移、把墙钟当北京时间；
  // 若不剥离偏移，dayjs.tz 会对带 +08:00 的串重复施加偏移导致结果偏 8h）。
  const s = dateStr.trim().replace('T', ' ').replace(/(?:[+-]\d{2}:?\d{2}|Z)$/, '').trim();
  const d = dayjs.tz(s, TZ);
  return d.isValid() ? d.valueOf() : NaN;
}

/**
 * 剩余天数（对应 User::getDaysAttr）
 * days = max((strtotime(expire_date) - strtotime(today)) / 86400 + 1, 0)
 */
export function daysFromExpire(expireDate: string | null | undefined): number {
  if (!expireDate) return 0;
  const expire = parseDate(expireDate);
  if (Number.isNaN(expire)) return 0;
  const today = parseDate(dateStr());
  return Math.max((expire - today) / 86400000 + 1, 0);
}

/**
 * 北京时间日期字符串加减天数（对应 admin rechange 里 date('Y-m-d', strtotime('±N day', strtotime(date('Y-m-d'))))）
 */
export function dateOffsetDays(days: number): string {
  return dayjs().tz(TZ).add(days, 'day').format('YYYY-MM-DD');
}

/** 当前时间（用于 Event 时间比较，等价于 date('Y-m-d H:i:s')） */
export function now(): string {
  return dateTimeStr();
}

/** 自动写入时间戳字段用的当前北京时间串（等价 autoWriteTimestamp = 'datetime'） */
export function tsNow(): string {
  return dateTimeStr();
}
