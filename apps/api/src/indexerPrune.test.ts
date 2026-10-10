import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { RETENTION, pruneIndexer, type Exec } from './services/indexerPrune';

const NOW = 1_791_600_000;
const DAY = 86_400;
let pg: PGlite;
let exec: Exec;

beforeEach(async () => {
  pg = new PGlite();
  // The two indexer tables the worker prunes, with Envio's quoted camelCase columns.
  await pg.exec(`
    create table "Trade" (id text primary key, token text, "timestamp" integer);
    create table "Candle" (id text primary key, token text, "interval" integer, "bucketStart" integer);
  `);
  exec = async (text, params) => (await pg.query(text, params)).affectedRows ?? 0;
});
afterEach(async () => {
  await pg.close();
});

const count = async (sql: string) => (await pg.query<{ n: number }>(`select count(*)::int as n from ${sql}`)).rows[0].n;

describe('pruneIndexer', () => {
  it('drops trades older than 7 days and old 1m/5m/1h candles, keeping daily candles', async () => {
    const ages = [0, 2 * DAY, 6 * DAY, 8 * DAY, 30 * DAY];
    for (const [i, age] of ages.entries()) await pg.query('insert into "Trade" values ($1, $2, $3)', [`t${i}`, 'x', NOW - age]);
    for (const interval of [60, 300, 3_600, 86_400]) {
      for (const [i, age] of ages.entries()) await pg.query('insert into "Candle" values ($1, $2, $3, $4)', [`${interval}-${i}`, 'x', interval, NOW - age]);
    }

    const res = await pruneIndexer(exec, NOW, { batch: 2 });
    expect(res.trades).toBe(2); // 8 and 30 days old
    expect(await count(`"Trade"`)).toBe(3);
    expect(await count(`"Candle" where "interval" = 60`)).toBe(1); // only the one from today
    expect(await count(`"Candle" where "interval" = 300`)).toBe(2); // today and 2 days
    expect(await count(`"Candle" where "interval" = 3600`)).toBe(4); // up to 8 days (kept 10)
    expect(await count(`"Candle" where "interval" = 86400`)).toBe(5); // all kept
    expect(res.candles).toBe(4 + 3 + 1);
  });

  it('stops after maxBatches per table so one run stays short', async () => {
    for (let i = 0; i < 10; i++) await pg.query('insert into "Trade" values ($1, $2, $3)', [`t${i}`, 'x', NOW - RETENTION.tradeSeconds - 1]);
    expect((await pruneIndexer(exec, NOW, { batch: 3, maxBatches: 2 })).trades).toBe(6);
    expect(await count(`"Trade"`)).toBe(4);
  });
});
