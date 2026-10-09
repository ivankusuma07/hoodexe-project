import type { Address } from 'viem';
import { z } from 'zod';
import { ROBINHOOD_CHAIN_ID } from '@hood/shared';
import type { Activity, LaunchSource, RawLaunch } from './tokenIndex';

/**
 * The Envio indexer's GraphQL (apps/indexer, Hasura). Numerics arrive as strings
 * (HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES), so uint256 amounts are parsed straight to bigint.
 */
export type EnvioClient = ReturnType<typeof envioClient>;

const big = z.coerce.bigint();
const decimal = z.union([z.string(), z.number()]).transform(String);

const tokenRow = z.object({
  id: z.string(),
  curve: z.string(),
  deployer: z.string(),
  pairToken: z.string(),
  graduationThreshold: big,
  launchBlock: z.number().int(),
  launchedAt: z.number().int(),
});

const candleRow = z.object({
  bucketStart: z.number().int(),
  open: decimal,
  high: decimal,
  low: decimal,
  close: decimal,
  volumeQuote: big,
  trades: z.number().int(),
});
export type EnvioCandle = z.output<typeof candleRow>;

const tradeRow = z.object({
  id: z.string(),
  trader: z.string(),
  isBuy: z.boolean(),
  quoteAmount: big,
  tokenAmount: big,
  price: decimal,
  timestamp: z.number().int(),
  txHash: z.string(),
});
export type EnvioTrade = z.output<typeof tradeRow>;

export function envioClient(graphqlUrl: string, pageSize = 1_000) {
  async function query<T>(text: string, variables: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: text, variables }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Envio GraphQL answered ${res.status}`);
    const body = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
    if (body.errors?.length) throw new Error(`Envio GraphQL: ${body.errors[0].message}`);
    return schema.parse(body.data);
  }

  /** Runs a paged query (it must take $limit and $offset) until a short page; `field` names the rows. */
  async function all<T>(text: string, variables: Record<string, unknown>, schema: z.ZodType<T[]>, field: string): Promise<T[]> {
    const out: T[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await query(text, { ...variables, limit: pageSize, offset }, z.object({ [field]: schema }).transform((d) => d[field] as T[]));
      out.push(...page);
      if (page.length < pageSize) return out;
    }
  }

  return {
    async latestBlock(): Promise<number> {
      const data = await query(
        '{ chain_metadata { chain_id latest_processed_block } }',
        {},
        z.object({ chain_metadata: z.array(z.object({ chain_id: z.number(), latest_processed_block: z.number().nullable() })) }),
      );
      const chain = data.chain_metadata.find((c) => c.chain_id === ROBINHOOD_CHAIN_ID);
      if (chain?.latest_processed_block == null) throw new Error('Envio has not indexed Robinhood Chain yet');
      return chain.latest_processed_block;
    },

    async launches(fromBlock: number, toBlock: number): Promise<RawLaunch[]> {
      const rows = await all(
        `query Launches($from: Int!, $to: Int!, $limit: Int!, $offset: Int!) {
          Token(where: { launchBlock: { _gte: $from, _lte: $to } }, order_by: [{ launchBlock: asc }, { id: asc }], limit: $limit, offset: $offset) {
            id curve deployer pairToken graduationThreshold launchBlock launchedAt
          }
        }`,
        { from: fromBlock, to: toBlock },
        z.array(tokenRow),
        'Token',
      );
      return rows.map((t) => ({
        token: t.id as Address,
        curve: t.curve as Address,
        deployer: t.deployer as Address,
        pairToken: t.pairToken as Address,
        graduationThreshold: t.graduationThreshold,
        blockNumber: t.launchBlock,
        timestamp: new Date(t.launchedAt * 1000),
      }));
    },

    /** Sums hourly candles per token since `since` (unix seconds, an hour boundary). */
    async activity(tokens: Address[], since: number): Promise<Map<Address, Activity>> {
      const out = new Map<Address, Activity>();
      for (let i = 0; i < tokens.length; i += 200) {
        const rows = await all(
          `query Activity($tokens: [String!]!, $since: Int!, $limit: Int!, $offset: Int!) {
            Candle(where: { token: { _in: $tokens }, interval: { _eq: 3600 }, bucketStart: { _gte: $since } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
              token volumeQuote trades
            }
          }`,
          { tokens: tokens.slice(i, i + 200), since },
          z.array(z.object({ token: z.string(), volumeQuote: big, trades: z.number().int() })),
          'Candle',
        );
        for (const r of rows) {
          const a = out.get(r.token as Address) ?? { volume: 0n, trades: 0 };
          out.set(r.token as Address, { volume: a.volume + r.volumeQuote, trades: a.trades + r.trades });
        }
      }
      return out;
    },

    /** Newest `limit` candles, oldest first. */
    async candles(token: string, interval: number, limit: number): Promise<EnvioCandle[]> {
      const data = await query(
        `query Candles($token: String!, $interval: Int!, $limit: Int!) {
          Candle(where: { token: { _eq: $token }, interval: { _eq: $interval } }, order_by: { bucketStart: desc }, limit: $limit) {
            bucketStart open high low close volumeQuote trades
          }
        }`,
        { token, interval, limit },
        z.object({ Candle: z.array(candleRow) }),
      );
      return data.Candle.reverse();
    },

    /** Buys of at least `minQuote` on these tokens after `afterBlock`, oldest first (system callouts). */
    async bigBuys(tokens: string[], minQuote: bigint, afterBlock: number, limit = 200): Promise<(EnvioTrade & { token: string; blockNumber: number })[]> {
      if (!tokens.length) return [];
      const data = await query(
        `query BigBuys($tokens: [String!]!, $min: numeric!, $after: Int!, $limit: Int!) {
          Trade(where: { token: { _in: $tokens }, isBuy: { _eq: true }, quoteAmount: { _gte: $min }, blockNumber: { _gt: $after } }, order_by: [{ blockNumber: asc }, { id: asc }], limit: $limit) {
            id token trader isBuy quoteAmount tokenAmount price timestamp txHash blockNumber
          }
        }`,
        { tokens, min: minQuote.toString(), after: afterBlock, limit },
        z.object({ Trade: z.array(tradeRow.extend({ token: z.string(), blockNumber: z.number().int() })) }),
      );
      return data.Trade;
    },

    /** Every curve trade where `wallet` bought, sold or received, oldest first (portfolio cost basis). */
    async walletTrades(wallet: string, max = 5_000): Promise<WalletTrade[]> {
      const rows = await all(
        `query WalletTrades($wallet: String!, $limit: Int!, $offset: Int!) {
          Trade(where: { _or: [{ trader: { _eq: $wallet } }, { recipient: { _eq: $wallet } }] }, order_by: [{ blockNumber: asc }, { id: asc }], limit: $limit, offset: $offset) {
            token trader recipient isBuy quoteAmount tokenAmount
          }
        }`,
        { wallet },
        z.array(z.object({ token: z.string(), trader: z.string(), recipient: z.string(), isBuy: z.boolean(), quoteAmount: big, tokenAmount: big })),
        'Trade',
      );
      return rows.slice(0, max);
    },

    /** Newest `limit` trades, newest first. */
    async trades(token: string, limit: number): Promise<EnvioTrade[]> {
      const data = await query(
        `query Trades($token: String!, $limit: Int!) {
          Trade(where: { token: { _eq: $token } }, order_by: [{ blockNumber: desc }, { id: desc }], limit: $limit) {
            id trader isBuy quoteAmount tokenAmount price timestamp txHash
          }
        }`,
        { token, limit },
        z.object({ Trade: z.array(tradeRow) }),
      );
      return data.Trade;
    },
  };
}

/**
 * Launch discovery from Envio; token metadata and live curve state still come from the RPC, which only
 * needs eth_call (fine on a free-tier provider, unlike eth_getLogs).
 */
export function envioLaunchSource(envio: EnvioClient, rpc: LaunchSource): LaunchSource {
  return {
    latestBlock: () => envio.latestBlock(),
    launches: (from, to) => envio.launches(from, to),
    activity: (tokens, since) => envio.activity(tokens, since),
    metadata: (tokens) => rpc.metadata(tokens),
    state: (items) => rpc.state(items),
  };
}

export type WalletTrade = { token: string; trader: string; recipient: string; isBuy: boolean; quoteAmount: bigint; tokenAmount: bigint };
