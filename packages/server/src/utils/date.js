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
 * 清晨 06:00:00 结算与天数累加算法（音游与TCG共用）
 * @param {string | Date | null | undefined} currentExpireDate 当前已有到期时间
 * @param {number} addDays 充值天数（如天卡 1 天，月卡 30 天）
 * @returns {string} 统一早 6:00:00 到期的标准北京时间字符串
 */
export function calculateExpire(currentExpireDate, addDays) {
  const currentTs = dayjs().tz(TZ);
  let base;
  if (currentExpireDate) {
    const parsed = dayjs.tz(currentExpireDate, TZ);
    if (parsed.isValid() && parsed.isAfter(currentTs)) {
      // 尚在有效期内：以现有到期时间为基准顺延
      base = parsed;
    }
  }

  if (!base) {
    // 首次开通或已过期：以当天 06:00:00 为基点
    base = dayjs().tz(TZ).startOf('day').hour(6).minute(0).second(0);
  }

  // 累加 addDays 天，时间严格锁定在次日/第N天早 06:00:00
  return base.add(addDays, 'day').hour(6).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * 计算距离早 06:00:00 到期的剩余天数（音游与TCG共用）
 * @param {string | Date | null | undefined} expireDate
 * @returns {number} 剩余天数（当天有效未过6点至少为1天）
 */
export function daysFromExpire(expireDate) {
  if (!expireDate) return 0;
  const expire = dayjs.tz(expireDate, TZ);
  const nowTs = dayjs().tz(TZ);
  if (!expire.isValid() || expire.isBefore(nowTs)) return 0;
  const diffMs = expire.diff(nowTs, 'millisecond');
  return Math.max(Math.ceil(diffMs / 86400000), 0);
}

// 别名兼容
export const calculateTcgExpire = calculateExpire;
export const daysFromTcgExpire = daysFromExpire;

/** 当前北京时间加减天数 */
export function dateOffsetDays(days) {
  return dayjs().tz(TZ).add(days, 'day').format('YYYY-MM-DD');
}

/** 当天起始时间 YYYY-MM-DD 00:00:00 */
export function startOfDayStr(d = new Date()) {
  return dayjs(d).tz(TZ).startOf('day').format('YYYY-MM-DD HH:mm:ss');
}

/** 当月起始时间 YYYY-MM-01 00:00:00 */
export function startOfMonthStr(d = new Date()) {
  return dayjs(d).tz(TZ).startOf('month').format('YYYY-MM-DD HH:mm:ss');
}

export function now() {
  return dateTimeStr();
}

export function tsNow() {
  return dateTimeStr();
}
