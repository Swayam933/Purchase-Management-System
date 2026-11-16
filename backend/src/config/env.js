import 'dotenv/config';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const toBool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const rawOrigin = process.env.CORS_ORIGIN ?? '*';

export const config = Object.freeze({
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 3000),
  corsOrigin:
    rawOrigin.trim() === '*'
      ? '*'
      : rawOrigin
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
  lowStockThreshold: toInt(process.env.LOW_STOCK_THRESHOLD, 5),
  seedData: toBool(process.env.SEED_DATA, true),
  logFormat: process.env.LOG_FORMAT ?? 'dev',
  database: Object.freeze({
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'item_purchase_db',
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  }),
});
