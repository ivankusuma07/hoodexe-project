import { BigDecimal, indexer, type EvmOnEventContext } from 'envio';

/** Candle intervals in seconds: 1m, 5m, 1h, 1d (docs/BRIEF.md §9). */
export const INTERVALS = [60, 300, 3_600, 86_400] as const;

// Every launch deploys its own curve; trades are only seen once the curve is registered here.
indexer.contractRegister({ contract: 'PonsV2Factory', event: 'TokenLaunched' }, async ({ event, context }) => {
  context.chain.PonsV2Curve.add(event.params.curve);
});

indexer.onEvent({ contract: 'PonsV2Factory', event: 'TokenLaunched' }, async ({ event, context }) => {
  const { token, curve, deployer, pairToken, launchConfigId, graduationThreshold } = event.params;
  context.Token.set({
    id: token,
    curve,
    deployer,
    pairToken,
    launchConfigId,
    graduationThreshold,
    launchBlock: event.block.number,
    launchedAt: event.block.timestamp,
    phase: 0,
    raisedQuote: 0n,
    volumeQuote: 0n,
    trades: 0,
    buys: 0,
    sells: 0,
    lastPrice: undefined,
    lastTradeAt: undefined,
  });
  context.Curve.set({ id: curve, token });
});

type TradeInput = {
  isBuy: boolean;
  trader: string;
  recipient: string;
  /** Gross quote: spent on a buy, taken off the curve on a sell. */
  quote: bigint;
  tokens: bigint;
  fee: bigint;
  tax: bigint;
  /** Change in the curve's quote reserve. */
  reserveDelta: bigint;
  /** Quote at the curve's price (before fees) for this fill. */
  curveQuote: bigint;
};

type TradeEvent = { srcAddress: string; logIndex: number; block: { number: number; timestamp: number }; transaction: { hash: string } };

/**
 * PonsV2BondingCurve: a buy emits `spent` (fee and creator tax included, refund excluded) and the curve
 * keeps spent − fee − tax; a sell emits the seller's net `quoteOut` and the curve gives up
 * quoteOut + fee + tax. Prices are taken at the curve, before fees.
 */
async function recordTrade(event: TradeEvent, context: EvmOnEventContext, t: TradeInput) {
  const curve = await context.Curve.get(event.srcAddress);
  if (!curve || t.tokens === 0n) return;
  const token = await context.Token.get(curve.token);
  if (!token) return;

  const price = new BigDecimal(t.curveQuote.toString()).div(t.tokens.toString());
  const ts = event.block.timestamp;

  context.Trade.set({
    id: `${event.block.number}-${event.logIndex}`,
    token: token.id,
    trader: t.trader,
    recipient: t.recipient,
    isBuy: t.isBuy,
    quoteAmount: t.quote,
    tokenAmount: t.tokens,
    fee: t.fee,
    tax: t.tax,
    price,
    blockNumber: event.block.number,
    timestamp: ts,
    txHash: event.transaction.hash,
  });

  context.Token.set({
    ...token,
    raisedQuote: token.raisedQuote + t.reserveDelta,
    volumeQuote: token.volumeQuote + t.quote,
    trades: token.trades + 1,
    buys: token.buys + (t.isBuy ? 1 : 0),
    sells: token.sells + (t.isBuy ? 0 : 1),
    lastPrice: price,
    lastTradeAt: ts,
  });

  // Positions: buys go to whoever received the tokens, sells come out of the seller's position.
  if (t.isBuy) {
    const id = `${t.recipient}-${token.id}`;
    const p = await context.Position.get(id);
    context.Position.set({ id, wallet: t.recipient, token: token.id, qty: (p?.qty ?? 0n) + t.tokens, cost: (p?.cost ?? 0n) + t.quote });
  } else {
    const id = `${t.trader}-${token.id}`;
    const p = await context.Position.get(id);
    if (p && p.qty > 0n) {
      const sold = t.tokens < p.qty ? t.tokens : p.qty;
      const qty = p.qty - sold;
      if (qty === 0n) context.Position.deleteUnsafe(id);
      else context.Position.set({ ...p, qty, cost: p.cost - (p.cost * sold) / p.qty });
    }
  }

  for (const interval of INTERVALS) {
    const bucketStart = ts - (ts % interval);
    const id = `${token.id}-${interval}-${bucketStart}`;
    const candle = await context.Candle.get(id);
    context.Candle.set(
      candle
        ? {
            ...candle,
            high: price.gt(candle.high) ? price : candle.high,
            low: price.lt(candle.low) ? price : candle.low,
            close: price,
            volumeQuote: candle.volumeQuote + t.quote,
            trades: candle.trades + 1,
          }
        : { id, token: token.id, interval, bucketStart, open: price, high: price, low: price, close: price, volumeQuote: t.quote, trades: 1 },
    );
  }
}

indexer.onEvent({ contract: 'PonsV2Curve', event: 'CurveBuy' }, async ({ event, context }) => {
  const { buyer, recipient, quoteIn, tokensOut, fee, tax } = event.params;
  const net = quoteIn - fee - tax;
  await recordTrade(event, context, { isBuy: true, trader: buyer, recipient, quote: quoteIn, tokens: tokensOut, fee, tax, reserveDelta: net, curveQuote: net });
});

indexer.onEvent({ contract: 'PonsV2Curve', event: 'CurveSell' }, async ({ event, context }) => {
  const { seller, recipient, tokensIn, quoteOut, fee, tax } = event.params;
  const gross = quoteOut + fee + tax;
  await recordTrade(event, context, { isBuy: false, trader: seller, recipient, quote: gross, tokens: tokensIn, fee, tax, reserveDelta: -gross, curveQuote: gross });
});

indexer.onEvent({ contract: 'PonsV2Factory', event: 'LaunchSwept' }, async ({ event, context }) => {
  const { token: id, quoteOut, tokenOut } = event.params;
  const token = await context.Token.get(id);
  if (token) context.Token.set({ ...token, phase: Math.max(token.phase, 1) });
  const g = await context.Graduation.get(id);
  context.Graduation.set({ id, poolAt: undefined, positionId: undefined, ...g, sweptAt: event.block.timestamp, sweptQuote: quoteOut, sweptTokens: tokenOut });
});

indexer.onEvent({ contract: 'PonsV2Factory', event: 'PoolGraduated' }, async ({ event, context }) => {
  const { token: id, positionId } = event.params;
  const token = await context.Token.get(id);
  if (token) context.Token.set({ ...token, phase: 2 });
  const g = await context.Graduation.get(id);
  context.Graduation.set({ id, sweptAt: undefined, sweptQuote: undefined, sweptTokens: undefined, ...g, poolAt: event.block.timestamp, positionId });
});
