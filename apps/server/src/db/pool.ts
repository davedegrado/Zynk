import pg from 'pg';

export type Db = pg.Pool;
export type Queryable = pg.Pool | pg.PoolClient;

// Return timestamptz as Date and bigint counts as numbers.
pg.types.setTypeParser(20, (v) => Number(v));

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

export async function withTransaction<T>(db: Db, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
