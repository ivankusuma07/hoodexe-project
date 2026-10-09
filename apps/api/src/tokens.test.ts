import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseEther, type Address } from 'viem';
import { NATIVE_PAIR, buildDescription } from '@hood/shared';
import { schema } from './db';
import { tokenIndex, type CurveState, type LaunchSource, type RawLaunch, type TokenMetadata } from './services/tokenIndex';
import { setup } from './test/helpers';

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx;

const USDG: Address = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const STATEMENT = '$\\sum 1/n^2 = \\pi^2/6$';

/** An in-memory chain: launches by block, metadata and curve state per token. */
function fakeSource() {
  const launches: RawLaunch[] = [];
  const meta = new Map<Address, TokenMetadata>();
  const state = new Map<Address, CurveState>();
  let latest = 1_000;
  const calls: [number, number][] = [];
  const source: LaunchSource = {
    latestBlock: async () => latest,
    launches: async (from, to) => {
      calls.push([from, to]);
      return launches.filter((l) => l.blockNumber >= from && l.blockNumber <= to);
    },
    metadata: async (tokens) => new Map(tokens.map((t) => [t, meta.get(t)!])),
    state: async (items) => new Map(items.filter((i) => state.has(i.token)).map((i) => [i.token, state.get(i.token)!])),
  };
  const launch = (n: number, block: number, m: Partial<TokenMetadata> = {}, pairToken: Address = NATIVE_PAIR) => {
    launches.push({
      token: addr(n),
      curve: addr(n + 10_000),
      deployer: addr(1),
      pairToken,
      graduationThreshold: pairToken === NATIVE_PAIR ? parseEther('4.2') : 8_090_000_000n,
      blockNumber: block,
      timestamp: new Date(1_791_500_000_000 + block * 100),
    });
    meta.set(addr(n), { name: `Coin ${n}`, symbol: `C${n}`, logo: '', description: 'just a memecoin', ...m });
  };
  return { source, launch, state, calls, setLatest: (b: number) => void (latest = b) };
}

const opts = { backfillBlocks: 500, chunkBlocks: 200, refreshRecent: 2 };

beforeEach(async () => {
  ctx = await setup();
});
afterEach(async () => {
  await ctx.close();
});

describe('token index', () => {
  it('backfills a window, then resumes from its cursor in chunks', async () => {
    const f = fakeSource();
    f.launch(1, 400); // before the backfill window (latest 1000 - 500)
    f.launch(2, 600);
    f.launch(3, 950);
    const index = tokenIndex(ctx.db, f.source, opts);
    expect(await index.sync()).toBe(2);
    expect(f.calls).toEqual([
      [500, 699],
      [700, 899],
      [900, 1000],
    ]);

    f.launch(4, 1_100);
    f.setLatest(1_200);
    expect(await index.sync()).toBe(1);
    expect(f.calls.at(-1)).toEqual([1_001, 1_200]);
    const rows = await ctx.db.select().from(schema.tokens);
    expect(rows.map((r) => r.symbol).sort()).toEqual(['C2', 'C3', 'C4']);
  });

  it('starts over when its cursor is past the chain head (another chain behind the RPC)', async () => {
    const f = fakeSource();
    const index = tokenIndex(ctx.db, f.source, opts);
    await index.sync();
    f.setLatest(700);
    f.launch(5, 650);
    expect(await index.sync()).toBe(1);
    expect(f.calls.at(-1)).toEqual([600, 700]);
  });

  it('recognises hood.exe launches and takes the server score, not the description', async () => {
    await ctx.app.inject({ method: 'POST', url: '/score-theorem', payload: { statement: STATEMENT } });
    const f = fakeSource();
    f.launch(1, 900, { description: buildDescription(STATEMENT, 100, 'bafymeta') });
    f.launch(2, 901, { description: '∑ forged\n— launched on hood.exe · rigor 99/100 · ipfs://bafyx' });
    await tokenIndex(ctx.db, f.source, opts).sync();
    const rows = await ctx.db.select().from(schema.tokens);
    const byToken = new Map(rows.map((r) => [r.tokenAddress, r]));
    expect(byToken.get(addr(1))).toMatchObject({ hood: true, statement: STATEMENT, metadataCid: 'bafymeta', rigorScore: 91 });
    // Parses as ours but was never scored by us: no score.
    expect(byToken.get(addr(2))).toMatchObject({ hood: true, rigorScore: null });
  });

  it('refreshes curve state for hood.exe tokens and the newest launches only', async () => {
    const f = fakeSource();
    f.launch(1, 600, { description: buildDescription(STATEMENT, null, 'bafy') });
    f.launch(2, 700);
    f.launch(3, 800);
    f.launch(4, 900);
    for (const n of [1, 2, 3, 4]) f.state.set(addr(n), { phase: 0, quoteReserve: parseEther('2'), tokenReserve: parseEther('800000000'), realQuoteReserve: parseEther('0.32') });
    const index = tokenIndex(ctx.db, f.source, opts);
    await index.sync();
    expect(await index.refresh()).toBe(3); // hood token + the 2 newest
    const rows = await ctx.db.select().from(schema.tokens);
    expect(rows.filter((r) => r.stateUpdatedAt).map((r) => r.symbol).sort()).toEqual(['C1', 'C3', 'C4']);
  });
});

describe('GET /tokens', () => {
  async function seed() {
    await ctx.app.inject({ method: 'POST', url: '/score-theorem', payload: { statement: STATEMENT } });
    const f = fakeSource();
    f.launch(1, 600, { description: buildDescription(STATEMENT, null, 'bafy') });
    f.launch(2, 700, { name: '<img src=x onerror=alert(1)>' });
    f.launch(3, 800, {}, USDG);
    f.state.set(addr(1), { phase: 0, quoteReserve: parseEther('2.1'), tokenReserve: parseEther('800000000'), realQuoteReserve: parseEther('0.42') });
    f.state.set(addr(2), { phase: 1, quoteReserve: 0n, tokenReserve: 0n, realQuoteReserve: parseEther('4.2') });
    f.state.set(addr(3), { phase: 0, quoteReserve: 4_045_000_000n, tokenReserve: parseEther('800000000'), realQuoteReserve: 4_045_000_000n });
    const index = tokenIndex(ctx.db, f.source, { ...opts, refreshRecent: 10 });
    await index.sync();
    await index.refresh();
  }
  const get = (qs: string) => ctx.app.inject({ method: 'GET', url: `/tokens${qs}` }).then((r) => r.json());

  it('lists the newest first with display numbers in the pair asset', async () => {
    await seed();
    const body = await get('');
    expect(body).toMatchObject({ total: 3, hoodCount: 1 });
    expect(body.items.map((i: { symbol: string }) => i.symbol)).toEqual(['C3', 'C2', 'C1']);
    const eth = body.items[2];
    expect(eth.pair).toEqual({ address: NATIVE_PAIR, symbol: 'ETH', decimals: 18 });
    expect(eth.price).toBeCloseTo(2.1 / 8e8, 15);
    expect(eth.marketCap).toBeCloseTo((2.1 / 8e8) * 1e9, 6);
    expect(eth.progress).toBeCloseTo(0.1, 6);
    const usdg = body.items[0];
    expect(usdg.pair.symbol).toBe('USDG');
    expect(usdg.progress).toBeCloseTo(0.5, 6);
    // Graduated: no curve price, full progress; the untrusted name comes back verbatim, as data.
    expect(body.items[1]).toMatchObject({ phase: 1, price: null, marketCap: null, progress: 1, name: '<img src=x onerror=alert(1)>' });
  });

  it('filters to hood.exe launches and sorts by rigor or market cap', async () => {
    await seed();
    expect((await get('?tab=hood')).items.map((i: { symbol: string }) => i.symbol)).toEqual(['C1']);
    expect((await get('?sort=rigor')).items[0]).toMatchObject({ symbol: 'C1', rigorScore: 91 });
    expect((await get('?sort=mcap')).items.map((i: { symbol: string }) => i.symbol)).toEqual(['C2', 'C3', 'C1']);
  });

  it('pages and validates its query', async () => {
    await seed();
    expect((await get('?limit=1&offset=1')).items.map((i: { symbol: string }) => i.symbol)).toEqual(['C2']);
    expect((await ctx.app.inject({ method: 'GET', url: '/tokens?sort=volume' })).statusCode).toBe(400);
    expect((await ctx.app.inject({ method: 'GET', url: '/tokens?limit=500' })).statusCode).toBe(400);
  });

  it('serves one token, case-insensitively', async () => {
    await seed();
    const res = await ctx.app.inject({ method: 'GET', url: `/tokens/${addr(1).toUpperCase().replace('0X', '0x')}` });
    expect(res.json()).toMatchObject({ symbol: 'C1', statement: STATEMENT, metadataCid: 'bafy', deployer: addr(1) });
    expect((await ctx.app.inject({ method: 'GET', url: `/tokens/${addr(99)}` })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'GET', url: '/tokens/nope' })).statusCode).toBe(400);
  });
});
