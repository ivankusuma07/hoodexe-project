import type { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { formatUnits, isAddress } from 'viem';
import { z } from 'zod';
import { PONS_TOTAL_SUPPLY, findPair } from '@hood/shared';
import { HttpError } from '../app';
import { schema } from '../db';

const CACHE_MS = 10_000;

const query = z.object({
  tab: z.enum(['all', 'hood']).default('all'),
  sort: z.enum(['latest', 'mcap', 'rigor']).default('latest'),
  limit: z.coerce.number().int().min(1).max(60).default(36),
  offset: z.coerce.number().int().min(0).max(5_000).default(0),
});

type TokenRow = typeof schema.tokens.$inferSelect;

/**
 * Display numbers in pair-asset units. Prices are floats on purpose: they are only shown, never used to
 * build a transaction (trades quote from live reserves with packages/shared/quote.ts).
 */
export function toItem(row: TokenRow) {
  const pair = findPair(row.pairToken);
  const decimals = pair?.decimals ?? 18;
  const onCurve = row.phase === 0 && row.quoteReserve != null && row.tokenReserve != null && BigInt(row.tokenReserve) > 0n;
  const price = onCurve ? Number(formatUnits(BigInt(row.quoteReserve!), decimals)) / Number(formatUnits(BigInt(row.tokenReserve!), 18)) : null;
  const threshold = BigInt(row.graduationThreshold);
  const raised = row.realQuoteReserve != null ? BigInt(row.realQuoteReserve) : null;
  return {
    token: row.tokenAddress,
    curve: row.curveAddress,
    name: row.name,
    symbol: row.symbol,
    logo: row.logo,
    pair: { address: row.pairToken, symbol: pair?.symbol ?? '?', decimals },
    hood: row.hood,
    statement: row.statement,
    /** First line of a non-hood.exe coin's description, for the card. Untrusted text. */
    blurb: row.hood ? null : (row.description.split('\n')[0] ?? '').slice(0, 140),
    rigorScore: row.rigorScore,
    phase: row.phase,
    /** Pair asset per token. */
    price,
    marketCap: price != null ? price * Number(PONS_TOTAL_SUPPLY) : null,
    /** Share of the graduation threshold raised, 0–1; 1 once the curve is done. */
    progress: row.phase > 0 ? 1 : raised != null && threshold > 0n ? Math.min(1, Number((raised * 10_000n) / threshold) / 10_000) : null,
    launchedAt: row.launchedAt.toISOString(),
    stateUpdatedAt: row.stateUpdatedAt?.toISOString() ?? null,
  };
}

export type TokenItem = ReturnType<typeof toItem>;

/** GET /tokens (Explore) and GET /tokens/:address (docs/BRIEF.md §9). */
export async function tokenRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const cache = new Map<string, { at: number; body: unknown }>();
  const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_MS) return hit.body as T;
    const body = await load();
    cache.set(key, { at: now, body });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return body;
  };

  app.get('/tokens', async (req) => {
    const q = query.parse(req.query);
    return cached(JSON.stringify(q), async () => {
      const where = q.tab === 'hood' ? eq(schema.tokens.hood, true) : undefined;
      // Market cap across pairs isn't comparable without USD prices (Phase 2). Every Pons curve has the
      // same shape relative to its threshold, so ranking by progress ranks by market cap within a pair
      // and puts graduated coins first.
      const order: SQL[] =
        q.sort === 'mcap'
          ? [
              desc(sql`${schema.tokens.phase} > 0`),
              sql`(${schema.tokens.realQuoteReserve} / nullif(${schema.tokens.graduationThreshold}, 0)) desc nulls last`,
              desc(schema.tokens.blockNumber),
            ]
          : q.sort === 'rigor'
            ? [sql`${schema.tokens.rigorScore} desc nulls last`, desc(schema.tokens.blockNumber)]
            : [desc(schema.tokens.blockNumber), asc(schema.tokens.tokenAddress)];
      const [rows, [{ total }], [{ hoodCount }]] = await Promise.all([
        db
          .select()
          .from(schema.tokens)
          .where(where)
          .orderBy(...order)
          .limit(q.limit)
          .offset(q.offset),
        db.select({ total: count() }).from(schema.tokens).where(where),
        db.select({ hoodCount: count() }).from(schema.tokens).where(eq(schema.tokens.hood, true)),
      ]);
      return { items: rows.map(toItem), total, hoodCount, offset: q.offset };
    });
  });

  app.get<{ Params: { address: string } }>('/tokens/:address', async (req) => {
    const address = req.params.address;
    if (!isAddress(address, { strict: false })) throw new HttpError(400, 'Invalid token address.');
    return cached(`token:${address.toLowerCase()}`, async () => {
      const [row] = await db
        .select()
        .from(schema.tokens)
        .where(and(sql`lower(${schema.tokens.tokenAddress}) = ${address.toLowerCase()}`))
        .limit(1);
      if (!row) throw new HttpError(404, 'hood.exe has not indexed this token yet.');
      return { ...toItem(row), deployer: row.deployer, description: row.description, metadataCid: row.metadataCid };
    });
  });
}
