// 雪花算法唯一订单号生成器（原 godruoyi/php-snowflake 对应实现）
import { SnowflakeId } from '@street-devs/snowflake-id';

const snowflake = new SnowflakeId({
  customEpoch: 1577836800000,
  machineId: { workerId: 0, dataCenterId: 1 },
});

export function generate() {
  return snowflake.generate().toString();
}
