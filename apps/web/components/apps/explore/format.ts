/** 2.91 ETH, 17.7K USDG, 0.000000029 ETH — display only. */
export function formatQuote(value: number | null, symbol: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return `0 ${symbol}`;
  const abs = Math.abs(value);
  const text =
    abs >= 10_000
      ? value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })
      : abs >= 1
        ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : value.toPrecision(3).replace(/\.?0+$/, '');
  return `${text} ${symbol}`;
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
