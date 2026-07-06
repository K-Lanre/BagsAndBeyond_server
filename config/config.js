require('dotenv').config();

const sslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const buildDialectOptions = () => (sslEnabled
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  : undefined);

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || 'bagsandbeyond',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    dialectOptions: buildDialectOptions(),
    logging: false
  },
  test: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_TEST || 'bagsandbeyond_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT_TEST || process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    dialectOptions: buildDialectOptions(),
    logging: false
  },
  production: {
    use_env_variable: process.env.DATABASE_URL ? 'DATABASE_URL' : undefined,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    dialectOptions: buildDialectOptions(),
    logging: false
  }
};
