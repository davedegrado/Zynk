import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import type { Db } from './pool';

function migrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/db -> ../../migrations ; dist -> ./migrations
  for (const candidate of [join(here, '../../migrations'), join(here, 'migrations'), join(here, '../migrations')]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('migrations directory not found');
}

/** Applies pending *.sql migrations in lexical order, each in its own transaction. */
export async function migrate(db: Db, log: (msg: string) => void = () => undefined): Promise<string[]> {
  await db.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const dir = migrationsDir();
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set((await db.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name));
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('begin');
      // Serialize concurrent migrators.
      await client.query('select pg_advisory_xact_lock(727274)');
      const again = await client.query('select 1 from schema_migrations where name = $1', [file]);
      if (again.rowCount === 0) {
        await client.query(sql);
        await client.query('insert into schema_migrations(name) values ($1)', [file]);
        ran.push(file);
        log(`applied migration ${file}`);
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return ran;
}
