/**
 * Keeps the self-hosted indexer's database inside Railway Hobby's 5 GB volume (docs/DEPLOY.md): Pons on
 * Robinhood Chain sees ~480k curve trades a day. Wallet cost basis lives in the indexer's Position table, so
 * old trades aren't needed; candles are kept as long as the charts and 24 h volume can ask for them.
 */
export const RETENTION = {
  /** Trades tab (newest 50 per coin) and big-buy callouts only look back this far. */
  tradeSeconds: 7 * 86_400,
  /** [interval, seconds kept]: charts ask for 200 candles (1m ≈ 3 h, 15m from 5m ≈ 2 d, 1h ≈ 8 d); 1d is kept. */
  candles: [
    [60, 86_400],
    [300, 3 * 86_400],
    [3_600, 10 * 86_400],
  ] as const,
};

/** Runs a statement and returns how many rows it affected. */
export type Exec = (text: string, params: unknown[]) => Promise<number>;

/** Deletes in batches so no statement holds locks for long; stops after `maxBatches` per table. */
async function deleteBatched(exec: Exec, table: string, where: string, params: unknown[], batch: number, maxBatches: number): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const n = await exec(`delete from "${table}" where ctid in (select ctid from "${table}" where ${where} limit ${batch})`, params);
    total += n;
    if (n < batch) break;
  }
  return total;
}

export async function pruneIndexer(exec: Exec, nowSeconds: number, opts: { batch?: number; maxBatches?: number } = {}): Promise<{ trades: number; candles: number }> {
  const batch = opts.batch ?? 20_000;
  const maxBatches = opts.maxBatches ?? 50;
  const trades = await deleteBatched(exec, 'Trade', '"timestamp" < $1', [nowSeconds - RETENTION.tradeSeconds], batch, maxBatches);
  let candles = 0;
  for (const [interval, keep] of RETENTION.candles) {
    candles += await deleteBatched(exec, 'Candle', '"interval" = $1 and "bucketStart" < $2', [interval, nowSeconds - keep], batch, maxBatches);
  }
  return { trades, candles };
}
