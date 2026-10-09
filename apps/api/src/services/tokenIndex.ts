import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import { createPublicClient, decodeEventLog, erc20Abi, http, toEventSelector, type Address, type Hex } from 'viem';
import { z } from 'zod';
import { PONS_V2, PUBLIC_RPC_MAINNET, ROBINHOOD_CHAIN_ID, parseDescription, ponsCurveAbi, ponsFactoryAbi, ponsTokenAbi, robinhoodChain } from '@hood/shared';
import { schema, type Db } from '../db';
import { storedScore } from '../routes/score';

export type RawLaunch = {
  token: Address;
  curve: Address;
  deployer: Address;
  pairToken: Address;
  graduationThreshold: bigint;
  blockNumber: number;
  timestamp: Date;
};

export type TokenMetadata = { name: string; symbol: string; logo: string; description: string };
export type CurveState = { phase: number; quoteReserve: bigint; tokenReserve: bigint; realQuoteReserve: bigint };

/** Where launches come from. RPC today; Envio replaces it without touching the index or the routes. */
export interface LaunchSource {
  latestBlock(): Promise<number>;
  launches(fromBlock: number, toBlock: number): Promise<RawLaunch[]>;
  metadata(tokens: Address[]): Promise<Map<Address, TokenMetadata>>;
  state(items: { token: Address; curve: Address }[]): Promise<Map<Address, CurveState>>;
}

const TOKEN_LAUNCHED_TOPIC = toEventSelector(ponsFactoryAbi.find((x) => x.type === 'event' && x.name === 'TokenLaunched')!);

export function rpcLaunchSource(rpcUrl: string = PUBLIC_RPC_MAINNET): LaunchSource {
  const client = createPublicClient({ chain: robinhoodChain(rpcUrl), transport: http(rpcUrl, { retryCount: 3 }) });
  const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

  return {
    latestBlock: async () => Number(await client.getBlockNumber()),

    async launches(fromBlock, toBlock) {
      // Raw request: Nitro returns blockTimestamp on each log, which saves a block lookup per launch.
      const logs = (await client.request({
        method: 'eth_getLogs',
        params: [
          {
            address: PONS_V2.launchFactory,
            topics: [TOKEN_LAUNCHED_TOPIC],
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock: `0x${toBlock.toString(16)}`,
          },
        ],
      } as never)) as { topics: [Hex, ...Hex[]]; data: Hex; blockNumber: Hex; blockTimestamp?: Hex }[];
      // Nitro sends blockTimestamp as 0x0 on logs, so look the blocks up (once each, 8 at a time: the public
      // RPC answers JSON-RPC batches with a Cloudflare challenge).
      const blocks = [...new Set(logs.filter((l) => !Number(l.blockTimestamp ?? 0)).map((l) => l.blockNumber))];
      const times = new Map<Hex, number>();
      for (let i = 0; i < blocks.length; i += 8) {
        const chunk = blocks.slice(i, i + 8);
        const fetched = await Promise.all(chunk.map((b) => client.getBlock({ blockNumber: BigInt(b) })));
        chunk.forEach((b, j) => times.set(b, Number(fetched[j].timestamp)));
      }
      return logs.map((log) => {
        const { args } = decodeEventLog({ abi: ponsFactoryAbi, eventName: 'TokenLaunched', topics: log.topics, data: log.data });
        const seconds = Number(log.blockTimestamp ?? 0) || times.get(log.blockNumber)!;
        return { ...args, blockNumber: Number(log.blockNumber), timestamp: new Date(seconds * 1000) };
      });
    },

    async metadata(tokens) {
      const results = await client.multicall({
        allowFailure: true,
        batchSize: 16_384,
        contracts: tokens.flatMap((address) => [
          { address, abi: ponsTokenAbi, functionName: 'getTokenInfo' } as const,
          { address, abi: erc20Abi, functionName: 'name' } as const,
          { address, abi: erc20Abi, functionName: 'symbol' } as const,
        ]),
      });
      const out = new Map<Address, TokenMetadata>();
      tokens.forEach((token, i) => {
        const [info, name, symbol] = results.slice(i * 3, i * 3 + 3);
        const tuple = info.status === 'success' ? (info.result as readonly [Address, string, string, unknown]) : null;
        out.set(token, {
          name: clip(name.status === 'success' ? String(name.result) : '', 64),
          symbol: clip(symbol.status === 'success' ? String(symbol.result) : '', 16),
          logo: clip(tuple?.[1] ?? '', 512),
          description: clip(tuple?.[2] ?? '', 2048),
        });
      });
      return out;
    },

    async state(items) {
      const results = await client.multicall({
        allowFailure: true,
        batchSize: 16_384,
        contracts: items.flatMap(({ token, curve }) => [
          { address: PONS_V2.launchFactory, abi: ponsFactoryAbi, functionName: 'getLaunchedToken', args: [token] } as const,
          { address: curve, abi: ponsCurveAbi, functionName: 'getReserves' } as const,
          { address: curve, abi: ponsCurveAbi, functionName: 'realQuoteReserve' } as const,
        ]),
      });
      const out = new Map<Address, CurveState>();
      items.forEach(({ token }, i) => {
        const [launched, reserves, real] = results.slice(i * 3, i * 3 + 3);
        if (launched.status !== 'success') return;
        const phase = (launched.result as { phase: number }).phase;
        const [quoteReserve, tokenReserve] = reserves.status === 'success' ? (reserves.result as readonly [bigint, bigint]) : [0n, 0n];
        out.set(token, { phase, quoteReserve, tokenReserve, realQuoteReserve: real.status === 'success' ? (real.result as bigint) : 0n });
      });
      return out;
    },
  };
}

const envioTokenSchema = z.object({
  id: z.string(),
  curve: z.string(),
  deployer: z.string(),
  pairToken: z.string(),
  graduationThreshold: z.coerce.bigint(),
  launchBlock: z.number().int(),
  launchedAt: z.number().int(),
});

/**
 * Launch discovery from the Envio indexer's GraphQL (apps/indexer); token metadata and live curve state
 * still come from the RPC, which only needs eth_call (fine on a free-tier provider, unlike eth_getLogs).
 */
export function envioLaunchSource(graphqlUrl: string, rpc: LaunchSource, pageSize = 1_000): LaunchSource {
  async function query<T>(query: string, variables: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Envio GraphQL answered ${res.status}`);
    const body = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
    if (body.errors?.length) throw new Error(`Envio GraphQL: ${body.errors[0].message}`);
    return schema.parse(body.data);
  }

  return {
    async latestBlock() {
      const data = await query(
        '{ chain_metadata { chain_id latest_processed_block } }',
        {},
        z.object({ chain_metadata: z.array(z.object({ chain_id: z.number(), latest_processed_block: z.number().nullable() })) }),
      );
      const chain = data.chain_metadata.find((c) => c.chain_id === ROBINHOOD_CHAIN_ID);
      if (chain?.latest_processed_block == null) throw new Error('Envio has not indexed Robinhood Chain yet');
      return chain.latest_processed_block;
    },

    async launches(fromBlock, toBlock) {
      const out: RawLaunch[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { Token: page } = await query(
          `query Launches($from: Int!, $to: Int!, $limit: Int!, $offset: Int!) {
            Token(where: { launchBlock: { _gte: $from, _lte: $to } }, order_by: [{ launchBlock: asc }, { id: asc }], limit: $limit, offset: $offset) {
              id curve deployer pairToken graduationThreshold launchBlock launchedAt
            }
          }`,
          { from: fromBlock, to: toBlock, limit: pageSize, offset },
          z.object({ Token: z.array(envioTokenSchema) }),
        );
        for (const t of page) {
          out.push({
            token: t.id as Address,
            curve: t.curve as Address,
            deployer: t.deployer as Address,
            pairToken: t.pairToken as Address,
            graduationThreshold: t.graduationThreshold,
            blockNumber: t.launchBlock,
            timestamp: new Date(t.launchedAt * 1000),
          });
        }
        if (page.length < pageSize) return out;
      }
    },

    metadata: (tokens) => rpc.metadata(tokens),
    state: (items) => rpc.state(items),
  };
}

export type TokenIndexOptions = {
  /** How far back the first run reaches. The public RPC serves logs for any range; state is live. */
  backfillBlocks: number;
  /** Blocks per eth_getLogs request (the RPC caps a response at 10,000 logs). */
  chunkBlocks: number;
  /** Curve state is refreshed for every hood.exe token plus this many of the newest launches. */
  refreshRecent: number;
  log?: (msg: string) => void;
};

const CURSOR = 'tokens:lastBlock';

export function tokenIndex(db: Db, source: LaunchSource, opts: TokenIndexOptions) {
  let syncing = false;
  let refreshing = false;
  const timers: NodeJS.Timeout[] = [];

  async function cursor(): Promise<number | null> {
    const [row] = await db.select().from(schema.indexState).where(eq(schema.indexState.key, CURSOR)).limit(1);
    return row ? Number(row.value) : null;
  }

  async function setCursor(block: number) {
    await db
      .insert(schema.indexState)
      .values({ key: CURSOR, value: String(block) })
      .onConflictDoUpdate({ target: schema.indexState.key, set: { value: String(block) } });
  }

  async function store(launches: RawLaunch[]) {
    for (let i = 0; i < launches.length; i += 100) {
      const batch = launches.slice(i, i + 100);
      const meta = await source.metadata(batch.map((l) => l.token));
      const rows = await Promise.all(
        batch.map(async (l) => {
          const m = meta.get(l.token) ?? { name: '', symbol: '', logo: '', description: '' };
          const parsed = parseDescription(m.description);
          const scored = parsed ? await storedScore(db, parsed.statement) : undefined;
          return {
            tokenAddress: l.token,
            curveAddress: l.curve,
            deployer: l.deployer,
            pairToken: l.pairToken,
            blockNumber: l.blockNumber,
            launchedAt: l.timestamp,
            ...m,
            hood: parsed != null,
            statement: parsed?.statement ?? null,
            metadataCid: parsed?.cid ?? null,
            rigorScore: scored?.score ?? null,
            graduationThreshold: l.graduationThreshold.toString(),
          };
        }),
      );
      if (rows.length) await db.insert(schema.tokens).values(rows).onConflictDoNothing();
    }
  }

  /** Pulls new TokenLaunched logs since the cursor. Returns how many launches were stored. */
  async function sync(): Promise<number> {
    if (syncing) return 0;
    syncing = true;
    try {
      const latest = await source.latestBlock();
      let last = await cursor();
      // Ahead of the chain means a different chain behind the same RPC URL (e.g. mainnet ↔ pnpm fork).
      if (last != null && last > latest) {
        opts.log?.(`token index cursor ${last} is past the chain head ${latest}; re-indexing from the backfill window`);
        last = null;
      }
      let from = (last ?? Math.max(0, latest - opts.backfillBlocks) - 1) + 1;
      let stored = 0;
      while (from <= latest) {
        const to = Math.min(from + opts.chunkBlocks - 1, latest);
        const launches = await source.launches(from, to);
        await store(launches);
        await setCursor(to);
        stored += launches.length;
        from = to + 1;
      }
      return stored;
    } finally {
      syncing = false;
    }
  }

  /** Re-reads phase and reserves for hood.exe tokens and the newest launches still on their curve. */
  async function refresh(): Promise<number> {
    if (refreshing) return 0;
    refreshing = true;
    try {
      const recent = db
        .select({ token: schema.tokens.tokenAddress })
        .from(schema.tokens)
        .orderBy(desc(schema.tokens.blockNumber))
        .limit(opts.refreshRecent);
      const rows = await db
        .select({ token: schema.tokens.tokenAddress, curve: schema.tokens.curveAddress, hood: schema.tokens.hood, statement: schema.tokens.statement, rigorScore: schema.tokens.rigorScore })
        .from(schema.tokens)
        .where(and(lt(schema.tokens.phase, 2), or(eq(schema.tokens.hood, true), inArray(schema.tokens.tokenAddress, recent))));
      const states = await source.state(rows.map((r) => ({ token: r.token as Address, curve: r.curve as Address })));
      const now = new Date();
      for (const r of rows) {
        const s = states.get(r.token as Address);
        if (!s) continue;
        await db
          .update(schema.tokens)
          .set({
            phase: s.phase,
            quoteReserve: s.quoteReserve.toString(),
            tokenReserve: s.tokenReserve.toString(),
            realQuoteReserve: s.realQuoteReserve.toString(),
            stateUpdatedAt: now,
          })
          .where(eq(schema.tokens.tokenAddress, r.token));
      }
      // A hood.exe statement can be scored after the launch was indexed (e.g. a re-score).
      const unscored = rows.filter((r) => r.hood && r.statement && r.rigorScore == null);
      for (const r of unscored) {
        const scored = await storedScore(db, r.statement!);
        if (scored) await db.update(schema.tokens).set({ rigorScore: scored.score }).where(eq(schema.tokens.tokenAddress, r.token));
      }
      return rows.length;
    } finally {
      refreshing = false;
    }
  }

  const guard = (name: string, fn: () => Promise<unknown>) => () =>
    fn().catch((e) => opts.log?.(`token index ${name} failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`));

  return {
    sync,
    refresh,
    /** Background loop: launches every 10 s, curve state every 30 s. */
    start() {
      void guard('sync', async () => {
        await sync();
        await refresh();
      })();
      timers.push(setInterval(guard('sync', sync), 10_000), setInterval(guard('refresh', refresh), 30_000));
    },
    stop() {
      for (const t of timers) clearInterval(t);
    },
  };
}

export type TokenIndex = ReturnType<typeof tokenIndex>;
