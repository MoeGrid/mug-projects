// 数据库表结构定义（对应老项目 app/model 各模型的字段与类型）
// 统一用 ColumnType<select, insert, update>：查询行 = 第一参数；插入/更新 = 可选对应类型
import type {ColumnType, Kysely} from 'kysely';

type Auto = ColumnType<number, number | undefined, number>; // 自增主键
type Ts = ColumnType<string, string | undefined, string>;   // 自动写入时间戳
type OptS = ColumnType<string, string | undefined, string | undefined>;
type OptN = ColumnType<number, number | undefined, number | undefined>;
type OptNS = ColumnType<string, string | null | undefined, string | null | undefined>;
type OptNN = ColumnType<number, number | null | undefined, number | null | undefined>;

export interface MugUserTable {
  id: Auto;
  open_id: string;
  session_key: OptS;
  token: OptS;
  nickname: OptS;
  avatar: OptNS;
  gender: OptN;
  country: OptS;
  province: OptS;
  city: OptS;
  phone: OptNS;
  qq: OptNS;
  remark: OptNS;
  is_admin: number;
  is_ban: number;
  balance: number;
  paseli_balance: OptN;
  expire_date: string;
  e_amusement: OptNS;
  create_time: Ts;
  update_time: Ts;
}

export interface MugDeviceTable {
  id: Auto;
  group_id: number;
  name: string;
  mac: OptS;
  client_id: OptS;
  price: number;
  coin: number;
  unit: OptS;
  sort: number;
  version: OptN;
  can_use_days: number | boolean;
  create_time: Ts;
  update_time: Ts;
}

export interface MugDeviceGroupTable {
  id: Auto;
  name: string;
  sort: number;
  create_time: Ts;
  update_time: Ts;
}

export interface MugBalanceLogTable {
  id: Auto;
  user_id: number;
  device_id: OptNN;
  num: number;
  balance: number;
  /** 1投币 2限免 3充值 4管理员修改 5PASELI兑换 */
  type: number;
  create_time: Ts;
  update_time: Ts;
}

export interface MugOrderTable {
  id: Auto;
  user_id: number;
  num: number;
  amount: number;
  we_order_id: string;
  /** 0未支付 1已支付 */
  status: number;
  /** 1购币 2PASELI充值 */
  type: number;
  paseli_user_id: OptN;
  pay_time: OptNS;
  create_time: Ts;
  update_time: Ts;
}

export interface MugSettingTable {
  key: string;
  value: OptS;
  remark: OptS;
  default: OptS;
}

export interface MugEventTable {
  id: Auto;
  name: string;
  start_time: string;
  end_time: string;
  amount: number;
  num: number;
  create_time: Ts;
  update_time: Ts;
}

export interface Database {
  mug_user: MugUserTable;
  mug_device: MugDeviceTable;
  mug_device_group: MugDeviceGroupTable;
  mug_balance_log: MugBalanceLogTable;
  mug_order: MugOrderTable;
  mug_setting: MugSettingTable;
  mug_event: MugEventTable;
}

export type Db = Kysely<Database>;

// 各表的查询行类型（对应老项目模型类名，= select 参数展开）
export type UserRow = { [K in keyof MugUserTable]: MugUserTable[K] extends ColumnType<infer S, any, any> ? S : MugUserTable[K] };
export type DeviceRow = { [K in keyof MugDeviceTable]: MugDeviceTable[K] extends ColumnType<infer S, any, any> ? S : MugDeviceTable[K] };
export type DeviceGroupRow = { [K in keyof MugDeviceGroupTable]: MugDeviceGroupTable[K] extends ColumnType<infer S, any, any> ? S : MugDeviceGroupTable[K] };
export type BalanceLogRow = { [K in keyof MugBalanceLogTable]: MugBalanceLogTable[K] extends ColumnType<infer S, any, any> ? S : MugBalanceLogTable[K] };
export type OrderRow = { [K in keyof MugOrderTable]: MugOrderTable[K] extends ColumnType<infer S, any, any> ? S : MugOrderTable[K] };
export type EventRow = { [K in keyof MugEventTable]: MugEventTable[K] extends ColumnType<infer S, any, any> ? S : MugEventTable[K] };
export type SettingRow = { [K in keyof MugSettingTable]: MugSettingTable[K] extends ColumnType<infer S, any, any> ? S : MugSettingTable[K] };
