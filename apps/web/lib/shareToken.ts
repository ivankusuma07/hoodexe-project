import { cacheLife } from 'next/cache';
import { isAddress } from 'viem';
import { formatQuote } from '@/components/apps/explore/format';

/** What a /t/0x… link preview shows. Server only. */
export type ShareToken = {
  symbol: string;
  name: string;
  logo: string;
  hood: boolean;
  statement: string | null;
  blurb: string | null;
  rigorScore: number | null;
  phase: number;
  price: number | null;
  marketCap: number | null;
  progress: number | null;
  pairSymbol: string;
};

/** The API's own URL: the /api proxy target in production, or NEXT_PUBLIC_API_URL when it's absolute (local dev). */
function apiBase(): string | null {
  const target = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || '';
  return target.startsWith('http') ? target.replace(/\/$/, '') : null;
}

/** One coin for link previews, cached for a few minutes so crawlers don't hit the API on every share. */
export async function getShareToken(address: string): Promise<ShareToken | null> {
  'use cache';
  cacheLife('minutes');
  const base = apiBase();
  if (!base || !isAddress(address, { strict: false })) return null;
  try {
    const res = await fetch(`${base}/tokens/${address}`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const t = (await res.json()) as Record<string, unknown> & { pair?: { symbol?: string } };
    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    return {
      symbol: str(t.symbol) ?? '?',
      name: str(t.name) ?? '',
      logo: str(t.logo) ?? '',
      hood: t.hood === true,
      statement: str(t.statement),
      blurb: str(t.blurb),
      rigorScore: num(t.rigorScore),
      phase: num(t.phase) ?? 0,
      price: num(t.price),
      marketCap: num(t.marketCap),
      progress: num(t.progress),
      pairSymbol: str(t.pair?.symbol) ?? '',
    };
  } catch {
    return null;
  }
}

const SYMBOLS: Record<string, string> = {
  pi: 'π', sum: 'Σ', prod: 'Π', infty: '∞', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', cdot: '·', times: '×',
  to: '→', rightarrow: '→', implies: '⇒', iff: '⇔', in: '∈', forall: '∀', exists: '∃', sqrt: '√', alpha: 'α', beta: 'β',
  gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ', phi: 'φ', zeta: 'ζ', mathbb: '',
};

/** A LaTeX statement as plain text for places that can't render KaTeX (link previews). */
export function plainStatement(source: string, max = 160): string {
  const text = source
    .replace(/\$+/g, '')
    .replace(/\\([a-zA-Z]+)/g, (m, cmd: string) => SYMBOLS[cmd] ?? cmd)
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** "∑ 91 · MCap 1.2 ETH · 34% to graduate" for descriptions. */
export function shareSummary(t: ShareToken): string {
  const parts = [
    t.hood && t.rigorScore != null ? `Rigor ${t.rigorScore}/100` : null,
    t.marketCap != null ? `MCap ${formatQuote(t.marketCap, t.pairSymbol)}` : null,
    t.phase > 0 ? 'Graduated to Uniswap V4' : t.progress != null ? `${Math.floor(t.progress * 100)}% to graduation` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}
