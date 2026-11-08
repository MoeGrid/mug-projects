// 数据库连接（对应老项目 config/database.php 的 mug 连接）
import {Kysely, MysqlDialect} from 'kysely';
import {createPool} from 'mysql2';
import {config} from '../config.js';
import type {Database} from './types.js';

export const db = new Kysely<Database>({
  dialect: new MysqlDialect({
    pool: createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      charset: config.db.charset,
      connectionLimit: 10,
    }),
  }),
});
