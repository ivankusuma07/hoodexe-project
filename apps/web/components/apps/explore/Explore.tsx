'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { RIGOR_DISCLAIMER } from '@hood/shared';
import { Button } from '@/components/xp/Button';
import { ProgressBar, StatusBar } from '@/components/xp/Controls';
import { Latex } from '@/components/xp/Latex';
import { RigorBadge } from '@/components/xp/RigorBadge';
import { ApiError, fetchTokens, type TokenItem, type TokenQuery } from '@/lib/api';
import { openApp, openToken } from '@/lib/openApp';
import type { WindowState } from '@/store/windows';
import { PHASE_LABEL, formatPercent, formatQuote } from './format';
import { TokenLogo } from './TokenLogo';
import styles from './Explore.module.css';

const PAGE = 36;
/** Explore opens on "All Pons" until hood.exe has this many launches (docs/BRIEF.md §5.3). */
const HOOD_TAB_MIN = 12;

const SORTS: { id: TokenQuery['sort'] | 'volume'; label: string; disabled?: string }[] = [
  { id: 'latest', label: 'Latest' },
  { id: 'volume', label: 'Volume', disabled: 'Volume needs trade history from the indexer' },
  { id: 'rigor', label: 'Rigor' },
  { id: 'mcap', label: 'MCap' },
];

export function Explore({ win }: { win: WindowState }) {
  const [tab, setTab] = useState<TokenQuery['tab'] | null>(null);
  const [sort, setSort] = useState<TokenQuery['sort']>('latest');

  // The tab is decided by the first answer (hoodCount), so the very first page always loads "all".
  const effectiveTab = tab ?? 'all';
  const q = useInfiniteQuery({
    queryKey: ['tokens', effectiveTab, sort],
    queryFn: ({ pageParam }) => fetchTokens({ tab: effectiveTab, sort, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined),
    refetchInterval: win.minimized ? false : 15_000,
  });

  const hoodCount = q.data?.pages[0]?.hoodCount ?? 0;
  if (tab == null && q.data && hoodCount >= HOOD_TAB_MIN) setTab('hood');

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  return (
    <div className={styles.explore}>
      <div className={styles.toolbar}>
        <div role="tablist" className={styles.tabs}>
          {(
            [
              ['hood', `hood.exe launches (${hoodCount})`],
              ['all', 'All Pons'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={effectiveTab === id} className={effectiveTab === id ? styles.tabActive : styles.tab} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className={styles.sort}>
          Sort by:{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as TokenQuery['sort'])}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id} disabled={!!s.disabled} title={s.disabled}>
                {s.label}
                {s.disabled ? ' (soon)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.view}>
        {q.isPending ? (
          <p className={styles.empty}>Looking for coins…</p>
        ) : q.isError ? (
          <p className={styles.empty}>{q.error instanceof ApiError ? q.error.message : 'Could not load coins.'}</p>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <p>{effectiveTab === 'hood' ? 'No hood.exe launches yet.' : 'No coins indexed yet.'}</p>
            <Button variant="primary" onClick={() => openApp('launch')}>
              ▶ Launch a Coin
            </Button>
          </div>
        ) : (
          <ul className={styles.grid}>
            {items.map((t) => (
              <TokenCard key={t.token} token={t} />
            ))}
          </ul>
        )}
        {q.hasNextPage && (
          <div className={styles.more}>
            <Button onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              {q.isFetchingNextPage ? 'Loading…' : 'Show more'}
            </Button>
          </div>
        )}
      </div>

      <StatusBar cells={[`${total.toLocaleString('en-US')} object${total === 1 ? '' : 's'}`, `AI-scored by rigor · ${RIGOR_DISCLAIMER}`]} />
    </div>
  );
}

function TokenCard({ token: t }: { token: TokenItem }) {
  const open = () => openToken(t.token, t.symbol);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        className={styles.card}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          open();
        }}
        aria-label={`$${t.symbol} ${t.name}`}
      >
        <div className={styles.cardHead}>
          <TokenLogo logo={t.logo} symbol={t.symbol} />
          <div className={styles.names}>
            <b>${t.symbol || '?'}</b>
            <span>{t.name}</span>
          </div>
          {t.hood && <RigorBadge score={t.rigorScore} />}
        </div>
        <div className={styles.snippet}>{t.hood && t.statement ? <Latex source={t.statement} /> : <span className={styles.plain}>{t.blurb}</span>}</div>
        <div className={styles.stats}>
          <span>MC {formatQuote(t.marketCap, t.pair.symbol)}</span>
          <span>{t.phase === 0 ? formatPercent(t.progress) : PHASE_LABEL[t.phase]}</span>
        </div>
        <ProgressBar value={(t.progress ?? 0) * 100} label={`Graduation progress for $${t.symbol}`} />
      </div>
    </li>
  );
}
