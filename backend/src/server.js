import { createApp } from './app.js';
import { config } from './config/env.js';
import { closeDatabase, databaseHealth } from './data/mysql.js';
import { seed } from './data/seed.js';

async function start() {
  await databaseHealth();
  if (config.seedData) {
    const records = await seed();
    console.log('[seed] MySQL demo data ensured:', records);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`\n  Item & Purchase Management System`);
    console.log(`  ------------------------------------------`);
    console.log(`  Frontend   http://localhost:${config.port}`);
    console.log(`  API        http://localhost:${config.port}/api`);
    console.log(`  Health     http://localhost:${config.port}/api/health`);
    console.log(`  Storage    MySQL (${config.database.host}:${config.database.port}/${config.database.name})`);
    console.log(`  Env        ${config.env}\n`);
  });

  const shutdown = (signal) => {
    console.log(`\n[${signal}] shutting down`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (error) => {
  console.error('[startup] Unable to connect to or query MySQL. Check DB_* settings and run database/schema.sql.', error);
  await closeDatabase();
  process.exitCode = 1;
});
