// Snowflake ID 生成（对应 app/facade/SnowflakeFacade.php，原 godruoyi/php-snowflake）
// 改用 @street-devs/snowflake-id：标准 时间戳 + 5bit dataCenter + 5bit worker + 12bit sequence 布局。
// epoch 与原项目保持一致（1577836800000 / 2020-01-01），worker=0 / dataCenter=1 对齐原 new Snowflake(1, 0)。
import {SnowflakeId} from '@street-devs/snowflake-id';

const snowflake = new SnowflakeId({
  customEpoch: 1577836800000,
  machineId: {workerId: 0, dataCenterId: 1},
});

/** Snowflake::generate() —— 返回字符串形式 ID */
export function generate(): string {
  return snowflake.generate().toString();
}
