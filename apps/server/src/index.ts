import { buildApp } from './app';
import { loadConfig } from './config';
import { migrate } from './db/migrate';
import { createPool } from './db/pool';
import { runRetention } from './jobs/retention';

const config = loadConfig();
const db = createPool(config.databaseUrl);
const app = await buildApp({ config, db });

await migrate(db, (m) => app.log.info(m));

const timers: NodeJS.Timeout[] = [];
if (config.retention.intervalMinutes > 0) {
  const tick = async () => {
    try {
      const result = await runRetention(db, { zynkDays: config.retention.zynkDays });
      const dead = await app.zynk.push.processReceipts();
      app.log.info({ event: 'retention', ...result, deadPushTokens: dead }, 'maintenance done');
    } catch (err) {
      app.log.error({ err }, 'maintenance failed');
    }
  };
  timers.push(setInterval(tick, config.retention.intervalMinutes * 60_000));
  setTimeout(tick, 30_000).unref();
}

const shutdown = async () => {
  timers.forEach(clearInterval);
  await app.close();
  await db.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: config.host, port: config.port });
