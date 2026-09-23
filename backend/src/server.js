import { createApp } from './app.js';
import { config } from './config/env.js';
import { seed } from './data/seed.js';
import { stats } from './data/store.js';

if (config.seedData) {
  seed();
  console.log('[seed] demo dataset loaded:', stats());
}

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`\n  Item & Purchase Management System`);
  console.log(`  ------------------------------------------`);
  console.log(`  Frontend   http://localhost:${config.port}`);
  console.log(`  API        http://localhost:${config.port}/api`);
  console.log(`  Health     http://localhost:${config.port}/api/health`);
  console.log(`  Storage    in-memory (resets on restart)`);
  console.log(`  Env        ${config.env}\n`);
});

const shutdown = (signal) => {
  console.log(`\n[${signal}] shutting down`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
