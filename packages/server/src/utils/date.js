// 日期工具（固定 Asia/Shanghai，UTC+8）
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

/** 北京时间 YYYY-MM-DD */
export function dateStr(d = new Date()) {
  return dayjs(d).tz(TZ).format('YYYY-MM-DD');
}

/** 北京时间 YYYY-MM-DD HH:mm:ss */
export function dateTimeStr(d = new Date()) {
  return dayjs(d).tz(TZ).format('YYYY-MM-DD HH:mm:ss');
}

/** 按北京时间解析为 epoch 毫秒 */
export function parseDate(dateInput) {
  if (!dateInput) return NaN;
  if (dateInput instanceof Date) {
    return dayjs(dateInput).tz(TZ).startOf('day').valueOf();
  }
  const s = String(dateInput).trim().replace('T', ' ').replace(/(?:[+-]\d{2}:?\d{2}|Z)$/, '').trim();
  const d = dayjs.tz(s, TZ);
  return d.isValid() ? d.valueOf() : NaN;
}

/**
 * 剩余天数计算
 * @param {string | Date | null | undefined} expireDate
 */
export function daysFromExpire(expireDate) {
  if (!expireDate) return 0;
  const expire = parseDate(expireDate);
  if (Number.isNaN(expire)) return 0;
  const today = parseDate(dateStr());
  return Math.max(Math.floor((expire - today) / 86400000) + 1, 0);
}

/** 当前北京时间加减天数 */
export function dateOffsetDays(days) {
  return dayjs().tz(TZ).add(days, 'day').format('YYYY-MM-DD');
}

export function now() {
  return dateTimeStr();
}

export function tsNow() {
  return dateTimeStr();
}
