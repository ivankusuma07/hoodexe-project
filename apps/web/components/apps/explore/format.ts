const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Display numbers for memecoin amounts and prices, never in exponent form:
 * 17.7K · 2.91 · 0.0535 · 0.000123 · 0.0₈17 (= 0.000000017: "0.0", then the count of further zeros as a
 * subscript, then 2–3 significant digits; the notation DEX screeners use for tiny prices).
 */
export function formatNumber(value: number, opts: { maxDecimals?: number } = {}): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 10_000) return sign + abs.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  if (abs >= 1) return sign + abs.toLocaleString('en-US', { maximumFractionDigits: opts.maxDecimals ?? 2 });
  if (abs >= 0.0001) return sign + abs.toPrecision(3).replace(/\.?0+$/, '');
  // abs = d.dd × 10^exp, exp ≤ −5: after "0." come (−exp − 1) zeros, then the digits.
  let exp = Math.floor(Math.log10(abs));
  let digits = Math.round(abs / 10 ** (exp - 2)); // three significant digits
  if (digits >= 1_000) {
    digits = Math.round(digits / 10);
    exp += 1;
  }
  // Rounded up into ordinary range (0.000099996 → 0.0001).
  if (exp > -5) return sign + String(Number((digits * 10 ** (exp - 2)).toPrecision(3)));
  const zeros = -exp - 1;
  const sub = String(zeros)
    .split('')
    .map((d) => SUBSCRIPT[Number(d)])
    .join('');
  return `${sign}0.0${sub}${String(digits).replace(/0+$/, '')}`;
}

/** 2.91 ETH, 17.7K USDG, 0.0₈17 ETH — display only. */
export function formatQuote(value: number | null, symbol: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatNumber(value)} ${symbol}`;
}

export const formatPercent = (progress: number | null) => (progress == null ? '—' : `${Math.floor(progress * 100)}%`);

/** "3 min ago", "5 h ago", "2 d ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3_600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

export const PHASE_LABEL = ['On curve', 'Graduating', 'Uniswap V4', 'Rescued'] as const;
