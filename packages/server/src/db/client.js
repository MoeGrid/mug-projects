// Kysely MySQL 数据库连接池
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import { config } from '../config.js';

export const db = new Kysely({
  dialect: new MysqlDialect({
    pool: createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      charset: config.db.charset,
      connectionLimit: 10,
      dateStrings: true,
    }),
  }),
});
