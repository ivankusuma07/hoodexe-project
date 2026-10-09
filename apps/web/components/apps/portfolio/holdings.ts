import type { Holding } from '@/lib/api';

export type HoldingSort = 'rigor' | 'value' | 'pnl';

/** Descending with nulls last. */
const desc = (a: number | null, b: number | null) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : b - a);

/**
 * Rigor first (docs/BRIEF.md §5.7: rigor-weighted), then value. Values in different pair assets
 * (ETH vs USDG) are compared as plain numbers; there's no ETH/USD price here to convert them.
 */
export function sortHoldings(holdings: Holding[], sort: HoldingSort): Holding[] {
  const byValue = (a: Holding, b: Holding) => desc(a.value, b.value);
  const cmp: Record<HoldingSort, (a: Holding, b: Holding) => number> = {
    rigor: (a, b) => desc(a.rigorScore, b.rigorScore) || byValue(a, b),
    value: byValue,
    pnl: (a, b) => desc(a.pnlPct, b.pnlPct) || byValue(a, b),
  };
  return [...holdings].sort(cmp[sort]);
}

export type PairTotal = { symbol: string; value: number; cost: number; pnl: number };

/** Value of every priced holding per pair asset; cost and P&L only over holdings with a known cost basis. */
export function totalsByPair(holdings: Holding[]): PairTotal[] {
  const out = new Map<string, PairTotal>();
  for (const h of holdings) {
    if (h.value == null) continue;
    const t = out.get(h.pair.symbol) ?? { symbol: h.pair.symbol, value: 0, cost: 0, pnl: 0 };
    t.value += h.value;
    if (h.costBasis != null && h.pnl != null) {
      t.cost += h.costBasis;
      t.pnl += h.pnl;
    }
    out.set(h.pair.symbol, t);
  }
  return [...out.values()];
}

/** Names and tickers are untrusted: quote every cell and defuse spreadsheet formulas. */
function cell(v: string | number | boolean | null): string {
  if (v == null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function holdingsCsv(holdings: Holding[]): string {
  const head = ['token', 'symbol', 'name', 'pair', 'balance', 'price', 'value', 'cost_basis', 'pnl', 'pnl_pct', 'rigor', 'phase', 'launched_by_me'];
  const rows = holdings.map((h) =>
    [h.token, h.symbol, h.name, h.pair.symbol, h.balance, h.price, h.value, h.costBasis, h.pnl, h.pnlPct, h.rigorScore, h.phase, h.launchedByMe].map(cell).join(','),
  );
  return [head.join(','), ...rows].join('\r\n') + '\r\n';
}
