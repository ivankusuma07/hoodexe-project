import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export { schema };
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
/** Arbitrary advisory-lock key for migrations (the chain id). */
const MIGRATION_LOCK = 4663;

/** Postgres over postgres.js, with migrations applied. Returns a close function for shutdown. */
export async function connectPostgres(url: string): Promise<{ db: Db; close: () => Promise<void> }> {
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const sql = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  // The API and the worker start together on deploy; one migrates while the other waits.
  const lock = await sql.reserve();
  try {
    await lock`select pg_advisory_lock(${MIGRATION_LOCK})`;
    await migrate(db, { migrationsFolder });
  } finally {
    await lock`select pg_advisory_unlock(${MIGRATION_LOCK})`.catch(() => {});
    lock.release();
  }
  return { db, close: () => sql.end({ timeout: 5 }) };
}

/** In-process Postgres (PGlite) for tests: same SQL, same migrations, no server. */
export async function connectMemory(): Promise<{ db: Db; close: () => Promise<void> }> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db, close: () => client.close() };
}
