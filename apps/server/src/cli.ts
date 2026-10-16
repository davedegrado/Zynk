import { loadConfig } from './config';
import { migrate } from './db/migrate';
import { createPool } from './db/pool';
import { runRetention } from './jobs/retention';
import { seed } from './seed';

const [cmd] = process.argv.slice(2);
const config = loadConfig();
const db = createPool(config.databaseUrl);
try {
  if (cmd === 'migrate') {
    const ran = await migrate(db, console.log);
    console.log(ran.length ? `Applied ${ran.length} migration(s).` : 'Database is up to date.');
  } else if (cmd === 'retention') {
    console.log(await runRetention(db, { zynkDays: config.retention.zynkDays }));
  } else if (cmd === 'seed') {
    await migrate(db);
    console.log(await seed(db, config.env));
  } else {
    console.error('Usage: cli <migrate|retention|seed>');
    process.exitCode = 1;
  }
} finally {
  await db.end();
}
