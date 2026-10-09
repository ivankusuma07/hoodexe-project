import { describe, expect, it } from 'vitest';
import { parseEther } from 'viem';
import { amountIn, amountOut, graduationProgress, quoteBuy, quoteSell, withSlippage, type CurveState } from './quote';

// A live V2 curve on chain 4663, with buy() results from eth_call against the deployed contract
// (packages/shared/scripts/check-pons.ts, 9 Oct 2026).
const LIVE: CurveState = {
  quoteReserve: 1_680_480_723_200_000_001n,
  tokenReserve: 999_713_937_093_497_509_034_851_667n,
  sellable: 713_999_651_379_211_794_749_137_382n,
  feeBps: 100n,
  creatorTaxBps: 208n,
};

describe('quoteBuy matches the deployed curve', () => {
  it.each([
    ['0.001', 576_242_405_118_459_959_129_359n],
    ['0.05', 28_020_704_667_008_267_539_318_381n],
    ['1', 365_675_282_817_039_511_226_989_083n],
  ])('buy %s ETH', (eth, contractTokensOut) => {
    const q = quoteBuy(LIVE, parseEther(eth));
    expect(q?.tokensOut).toBe(contractTokensOut);
    expect(q?.completesCurve).toBe(false);
    expect(q?.refund).toBe(0n);
  });

  it('clamps the buy that finishes the curve and refunds the rest', () => {
    const q = quoteBuy(LIVE, parseEther('50'))!;
    expect(q.tokensOut).toBe(LIVE.sellable);
    expect(q.completesCurve).toBe(true);
    expect(q.spent).toBeLessThan(parseEther('50'));
    expect(q.refund).toBe(parseEther('50') - q.spent);
  });

  it('splits fee and creator tax from the input', () => {
    const q = quoteBuy(LIVE, parseEther('1'))!;
    expect(q.fee).toBe(parseEther('0.01'));
    expect(q.creatorTax).toBe(parseEther('0.0208'));
    expect(q.snipeTax).toBe(0n);
  });

  it('deducts the snipe tax from the input too', () => {
    const plain = quoteBuy(LIVE, parseEther('1'))!;
    // 100 + 208 + 9900 bps is more than the whole input, so nothing is left to price.
    expect(quoteBuy(LIVE, parseEther('1'), 9_900n)).toBeNull();
    const partly = quoteBuy(LIVE, parseEther('1'), 2_500n)!;
    expect(partly.snipeTax).toBe(parseEther('0.25'));
    expect(partly.tokensOut).toBeLessThan(plain.tokensOut);
  });

  it('reports positive price impact that grows with size', () => {
    const small = quoteBuy(LIVE, parseEther('0.001'))!;
    const big = quoteBuy(LIVE, parseEther('1'))!;
    expect(small.priceImpactBps).toBeGreaterThan(0n);
    expect(big.priceImpactBps).toBeGreaterThan(small.priceImpactBps);
  });

  it('returns null when nothing can be bought', () => {
    expect(quoteBuy(LIVE, 0n)).toBeNull();
    expect(quoteBuy({ ...LIVE, sellable: 0n }, parseEther('1'))).toBeNull();
  });
});

describe('quoteSell', () => {
  it('prices against reserves, then takes fee and tax from the output', () => {
    const tokens = 10_000_000n * 10n ** 18n;
    const q = quoteSell(LIVE, tokens)!;
    expect(q.grossQuoteOut).toBe(amountOut(tokens, LIVE.tokenReserve, LIVE.quoteReserve));
    expect(q.fee).toBe((q.grossQuoteOut * 100n) / 10_000n);
    expect(q.creatorTax).toBe((q.grossQuoteOut * 208n) / 10_000n);
    expect(q.quoteOut).toBe(q.grossQuoteOut - q.fee - q.creatorTax);
  });

  it('round-trips a buy at a loss of roughly two rounds of fees', () => {
    const buy = quoteBuy(LIVE, parseEther('0.1'))!;
    const after: CurveState = {
      ...LIVE,
      quoteReserve: LIVE.quoteReserve + buy.spent - buy.fee - buy.creatorTax,
      tokenReserve: LIVE.tokenReserve - buy.tokensOut,
    };
    const sell = quoteSell(after, buy.tokensOut)!;
    expect(sell.quoteOut).toBeLessThan(parseEther('0.1'));
    expect(sell.quoteOut).toBeGreaterThan(parseEther('0.093'));
  });
});

describe('maths helpers', () => {
  it('amountIn inverts amountOut, rounding up', () => {
    const out = amountOut(parseEther('1'), LIVE.quoteReserve, LIVE.tokenReserve);
    const back = amountIn(out, LIVE.quoteReserve, LIVE.tokenReserve);
    expect(back).toBeGreaterThan(0n);
    expect(back).toBeLessThanOrEqual(parseEther('1') + 1n);
  });

  it('withSlippage takes the tolerance off', () => {
    expect(withSlippage(10_000n, 500n)).toBe(9_500n);
  });

  it('graduationProgress clamps to 0-1', () => {
    expect(graduationProgress(parseEther('2.1'), parseEther('4.2'))).toBe(0.5);
    expect(graduationProgress(parseEther('9'), parseEther('4.2'))).toBe(1);
    expect(graduationProgress(0n, 0n)).toBe(0);
  });
});
