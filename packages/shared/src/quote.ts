/**
 * Bonding-curve quotes, ported from PonsV2BondingCurve.buy/sell and PonsV2BondingCurveMath.
 * Integer maths matches the contract (floor division, +1 on getAmountIn) so a quote equals the fill
 * whenever reserves don't move first. The snipe tax isn't in the published source; per the Pons docs it
 * is deducted from the input alongside the fee and creator tax, so it is modelled the same way. The
 * wallet flow still simulates the transaction before signing, which is the authoritative number.
 */

export const BPS = 10_000n;

/** PonsV2BondingCurveMath.getAmountOut with feeBps = 0 (the curve always passes 0). */
export function amountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  return (amountIn * reserveOut) / (reserveIn + amountIn);
}

/** PonsV2BondingCurveMath.getAmountIn with feeBps = 0. */
export function amountIn(amountOut_: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountOut_ <= 0n || reserveIn <= 0n || reserveOut <= amountOut_) return 0n;
  return (amountOut_ * reserveIn) / (reserveOut - amountOut_) + 1n;
}

const ceilMulDiv = (a: bigint, b: bigint, d: bigint) => (a * b + d - 1n) / d;
const min = (a: bigint, b: bigint) => (a < b ? a : b);

export type CurveState = {
  /** getReserves().quoteReserve — phantom + real quote, net of booked fees. */
  quoteReserve: bigint;
  /** getReserves().tokenReserve */
  tokenReserve: bigint;
  /** sellableTokens(): what the curve may still sell before graduating. */
  sellable: bigint;
  feeBps: bigint;
  creatorTaxBps: bigint;
};

export type BuyQuote = {
  tokensOut: bigint;
  /** Quote actually spent; less than the input when the last buy before graduation is clamped. */
  spent: bigint;
  refund: bigint;
  fee: bigint;
  creatorTax: bigint;
  snipeTax: bigint;
  /** True when this buy would finish the curve (fill clamped to the remaining sellable tokens). */
  completesCurve: boolean;
  /** Execution price vs. spot, in basis points. */
  priceImpactBps: bigint;
};

export function quoteBuy(state: CurveState, quoteIn: bigint, snipeTaxBps = 0n): BuyQuote | null {
  const { quoteReserve, tokenReserve, sellable, feeBps, creatorTaxBps } = state;
  if (quoteIn <= 0n || sellable <= 0n || quoteReserve <= 0n || tokenReserve <= 0n) return null;

  const deductBps = feeBps + creatorTaxBps + snipeTaxBps;
  if (deductBps >= BPS) return null;

  let spent = quoteIn;
  let fee = (spent * feeBps) / BPS;
  let creatorTax = (spent * creatorTaxBps) / BPS;
  let snipeTax = (spent * snipeTaxBps) / BPS;
  let tokensOut = amountOut(spent - fee - creatorTax - snipeTax, quoteReserve, tokenReserve);
  let completesCurve = false;

  if (tokensOut > sellable) {
    // Contract: price the clamped fill from the token side, then gross back up so the fee legs still
    // come out of the input; the unspent remainder is refunded.
    tokensOut = sellable;
    completesCurve = true;
    const net = amountIn(sellable, quoteReserve, tokenReserve);
    spent = min(ceilMulDiv(net, BPS, BPS - deductBps), quoteIn);
    fee = (spent * feeBps) / BPS;
    creatorTax = (spent * creatorTaxBps) / BPS;
    snipeTax = (spent * snipeTaxBps) / BPS;
  }
  if (tokensOut <= 0n) return null;

  // spot = quoteReserve / tokenReserve; exec = spent / tokensOut; impact = exec / spot - 1
  const priceImpactBps = (spent * tokenReserve * BPS) / (tokensOut * quoteReserve) - BPS;

  return { tokensOut, spent, refund: quoteIn - spent, fee, creatorTax, snipeTax, completesCurve, priceImpactBps };
}

export type SellQuote = {
  quoteOut: bigint;
  grossQuoteOut: bigint;
  fee: bigint;
  creatorTax: bigint;
  priceImpactBps: bigint;
};

export function quoteSell(state: CurveState, tokensIn: bigint): SellQuote | null {
  const { quoteReserve, tokenReserve, feeBps, creatorTaxBps } = state;
  if (tokensIn <= 0n || quoteReserve <= 0n || tokenReserve <= 0n) return null;
  const grossQuoteOut = amountOut(tokensIn, tokenReserve, quoteReserve);
  if (grossQuoteOut <= 0n) return null;
  const fee = (grossQuoteOut * feeBps) / BPS;
  const creatorTax = (grossQuoteOut * creatorTaxBps) / BPS;
  const quoteOut = grossQuoteOut - fee - creatorTax;
  // spot = quoteReserve / tokenReserve; exec = grossQuoteOut / tokensIn; impact = 1 - exec / spot
  const priceImpactBps = BPS - (grossQuoteOut * tokenReserve * BPS) / (tokensIn * quoteReserve);
  return { quoteOut, grossQuoteOut, fee, creatorTax, priceImpactBps };
}

/** Lower bound for a slippage tolerance, e.g. 500 bps → 95% of the quote. */
export function withSlippage(amount: bigint, slippageBps: bigint): bigint {
  return (amount * (BPS - slippageBps)) / BPS;
}

/** Share of the graduation threshold raised so far, 0–1. */
export function graduationProgress(realQuoteReserve: bigint, graduationThreshold: bigint): number {
  if (graduationThreshold <= 0n) return 0;
  const ratio = Number((realQuoteReserve * 10_000n) / graduationThreshold) / 10_000;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * Points for drawing a launch's curve before it exists: price (quote per token) against the share of the
 * threshold raised. Constant product with k = phantomQuote × supply, so price = (phantom + q)² / k.
 */
export function curvePreview(phantomQuote: number, supply: number, graduationThreshold: number, steps = 48) {
  const k = phantomQuote * supply;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const raised = (graduationThreshold * i) / steps;
    const quote = phantomQuote + raised;
    return { raised, progress: i / steps, price: (quote * quote) / k };
  });
}
