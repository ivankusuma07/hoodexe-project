import { afterEach, describe, expect, it } from 'vitest';
import { parseEther, type Address } from 'viem';
import { NATIVE_PAIR, buildDescription } from '@hood/shared';
import { schema } from './db';
import { costLedger } from './routes/portfolio';
import type { EnvioClient, WalletTrade } from './services/envio';
import { alice, bob, setup } from './test/helpers';

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx | undefined;
afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

const USDG: Address = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const STATEMENT = '$e^{i\\pi} + 1 = 0$';
const M = 10n ** 18n;

const buy = (token: Address, tokens: bigint, quote: bigint, recipient: Address = alice.address, trader: Address = recipient): WalletTrade => ({
  token: token.toLowerCase(),
  trader: trader.toLowerCase(),
  recipient: recipient.toLowerCase(),
  isBuy: true,
  quoteAmount: quote,
  tokenAmount: tokens,
});
const sell = (token: Address, tokens: bigint, quote: bigint, trader: Address = alice.address): WalletTrade => ({
  ...buy(token, tokens, quote, trader),
  isBuy: false,
});

async function seed(trades: WalletTrade[] | null) {
  const envio = trades ? ({ walletTrades: async () => trades } as unknown as EnvioClient) : undefined;
  ctx = await setup({ envio });
  // A: alice's own launch, in the token table.
  await ctx!.db.insert(schema.tokens).values({
    tokenAddress: addr(1),
    curveAddress: addr(10_001),
    deployer: alice.address,
    pairToken: NATIVE_PAIR,
    blockNumber: 900,
    launchedAt: new Date('2026-10-08T12:00:00Z'),
    name: 'Coin A',
    symbol: 'AAA',
    logo: 'ipfs://logo-a',
    description: 'just a memecoin',
    graduationThreshold: parseEther('4.2').toString(),
  });
  ctx!.market.state.set(addr(1), { phase: 0, quoteReserve: parseEther('2'), tokenReserve: 800_000_000n * M, realQuoteReserve: 0n });
  // B: someone else's hood.exe coin on USDG, older than the token table.
  await ctx!.app.inject({ method: 'POST', url: '/score-theorem', payload: { statement: STATEMENT } });
  ctx!.launchRecords.set(addr(2), { curve: addr(10_002), deployer: bob.address, pairToken: USDG, graduationThreshold: 8_090_000_000n, launchedAt: null });
  ctx!.market.meta.set(addr(2), { name: 'Coin B', symbol: 'BBB', logo: '', description: buildDescription(STATEMENT, 99, 'bafyb') });
  ctx!.market.state.set(addr(2), { phase: 0, quoteReserve: 4_000_000_000n, tokenReserve: 400_000_000n * M, realQuoteReserve: 0n });
  // C: graduated; D: not a Pons coin at all.
  ctx!.launchRecords.set(addr(3), { curve: addr(10_003), deployer: bob.address, pairToken: NATIVE_PAIR, graduationThreshold: parseEther('4.2'), launchedAt: null });
  ctx!.market.meta.set(addr(3), { name: 'Coin C', symbol: 'CCC', logo: '', description: 'meme' });
  ctx!.market.state.set(addr(3), { phase: 2, quoteReserve: 0n, tokenReserve: 0n, realQuoteReserve: 0n });

  const hold = (n: number, amount: bigint) => ctx!.tokenBalances.set(`${addr(n)}:${alice.address.toLowerCase()}`, amount);
  hold(1, 1_000_000n * M);
  hold(2, 1_000n * M);
  hold(3, 5n * M);
  hold(4, 7n * M);
  hold(5, 0n);
}

const get = (wallet: string) => ctx!.app.inject({ method: 'GET', url: `/portfolio/${wallet}` });

describe('costLedger', () => {
  it('averages cost over buys and releases it pro rata on sells', () => {
    const l = costLedger(alice.address, [
      buy(addr(1), 2_000n, 200n),
      buy(addr(1), 2_000n, 600n),
      sell(addr(1), 1_000n, 999n), // avg 0.2/token: releases 200
      sell(addr(2), 50n, 5n), // nothing bought before: ignored
    ]);
    expect(l.get(addr(1))).toEqual({ qty: 3_000n, cost: 600n });
    expect(l.get(addr(2))).toEqual({ qty: 0n, cost: 0n });
  });

  it('counts buys sent to the wallet, not ones it paid for someone else', () => {
    const l = costLedger(alice.address, [buy(addr(1), 100n, 10n, alice.address, bob.address), buy(addr(1), 100n, 10n, bob.address, alice.address)]);
    expect(l.get(addr(1))).toEqual({ qty: 100n, cost: 10n });
  });

  it('never sells more than it holds', () => {
    const l = costLedger(alice.address, [buy(addr(1), 100n, 10n), sell(addr(1), 150n, 20n)]);
    expect(l.get(addr(1))).toEqual({ qty: 0n, cost: 0n });
  });
});

// Each test boots its own PGlite (the indexer on or off), which is slow under a full parallel run.
describe('GET /portfolio/:wallet', { timeout: 30_000 }, () => {
  it('lists holdings with value and cost basis, and the wallet’s launches', async () => {
    await seed([
      buy(addr(1), 2_000_000n * M, parseEther('0.02')),
      sell(addr(1), 1_000_000n * M, parseEther('0.015')),
      buy(addr(2), 1_000n * M, 5_000_000n, alice.address, bob.address), // bob bought for alice
      buy(addr(3), 5n * M, parseEther('0.1')),
      buy(addr(4), 7n * M, 1n),
      buy(addr(5), 9n * M, parseEther('1')),
    ]);
    const res = await get(alice.address.toLowerCase());
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.wallet).toBe(alice.address);
    expect(body.tradeHistory).toBe(true);
    expect(body.launches.map((l: { symbol: string }) => l.symbol)).toEqual(['AAA']);

    const by = Object.fromEntries(body.holdings.map((h: { symbol: string }) => [h.symbol, h]));
    expect(Object.keys(by).sort()).toEqual(['AAA', 'BBB', 'CCC']); // D isn't Pons, E is sold out

    // 1M tokens at 2 ETH / 800M = 0.0025 ETH, bought for 0.01 ETH net of the sell.
    expect(by.AAA).toMatchObject({ launchedByMe: true, hood: false, balance: 1_000_000, value: 0.0025, costBasis: 0.01, pnlPct: -75 });
    expect(by.AAA.pnl).toBeCloseTo(-0.0075, 12);
    expect(by.AAA.price).toBeCloseTo(2.5e-9, 18);

    // Scored server-side (91), not the 99 written in the description.
    expect(by.BBB).toMatchObject({ launchedByMe: false, hood: true, rigorScore: 91, pair: { symbol: 'USDG', decimals: 6 }, value: 0.01, costBasis: 5 });
    expect(by.BBB.pnl).toBeCloseTo(-4.99, 6);
    expect(by.BBB.pnlPct).toBeCloseTo(-99.8, 6);

    // Graduated: no curve price to mark at.
    expect(by.CCC).toMatchObject({ phase: 2, value: null, price: null, pnl: null, costBasis: 0.1 });
  });

  it('leaves cost unknown when the wallet holds more than its trades explain', async () => {
    await seed([buy(addr(1), 10n * M, parseEther('0.01'))]);
    const [a] = (await get(alice.address)).json().holdings;
    expect(a).toMatchObject({ symbol: 'AAA', costBasis: null, pnl: null, pnlPct: null });
    expect(a.value).toBeCloseTo(0.0025, 12);
  });

  it('falls back to the wallet’s own launches without the indexer', async () => {
    await seed(null);
    const body = (await get(alice.address)).json();
    expect(body.tradeHistory).toBe(false);
    expect(body.holdings.map((h: { symbol: string }) => h.symbol)).toEqual(['AAA']);
    expect(body.holdings[0].costBasis).toBeNull();
  });

  it('answers an empty portfolio and rejects bad addresses', async () => {
    await seed([]);
    expect((await get(bob.address)).json()).toEqual({ wallet: bob.address, holdings: [], launches: [], tradeHistory: true });
    expect((await get('0x123')).statusCode).toBe(400);
  });
});
