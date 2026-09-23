/**
 * Application configuration.
 *
 * Values are read from the environment with safe defaults so the app boots with
 * zero setup. Use `node --env-file=.env src/server.js` to load `.env`.
 */

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

  /** `*` (any origin) or an explicit allow-list. */
  corsOrigin:
    rawOrigin.trim() === '*'
      ? '*'
      : rawOrigin
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),

  /** Stock at or below this value is labelled "Low Stock". 0 disables the label. */
  lowStockThreshold: toInt(process.env.LOW_STOCK_THRESHOLD, 5),

  /** Load the demo dataset from section 17 of the assignment on boot. */
  seedData: toBool(process.env.SEED_DATA, true),

  logFormat: process.env.LOG_FORMAT ?? 'dev',
});
