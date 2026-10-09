'use client';

import { useCallback, useState } from 'react';
import type { CalloutPage } from '@/lib/api';
import { useLiveStatus } from '@/lib/live';
import { CalloutFeed } from './CalloutFeed';
import styles from './Callouts.module.css';

/** Callouts.exe (docs/BRIEF.md §5.5): the live feed with its "🟢 LIVE — N callouts · M users" header. */
export function Callouts() {
  const status = useLiveStatus((s) => s.status);
  const [live, setLive] = useState<CalloutPage['live'] | null>(null);
  const onLiveCounts = useCallback((l: CalloutPage['live']) => setLive(l), []);
  const isLive = status === 'live';

  return (
    <div className={styles.window}>
      <div className={styles.header}>
        <span className={`${styles.dot} ${isLive ? styles.dotLive : styles.dotDown}`} aria-hidden />
        <b>{isLive ? 'LIVE' : status === 'polling' ? 'RECONNECTING' : 'CONNECTING'}</b>
        {live && (
          <span>
            {' '}
            — {live.callouts.toLocaleString('en-US')} callout{live.callouts === 1 ? '' : 's'} · {live.users.toLocaleString('en-US')} user{live.users === 1 ? '' : 's'}
            <span className={styles.muted}> (24 h)</span>
          </span>
        )}
      </div>
      <CalloutFeed onLiveCounts={onLiveCounts} />
    </div>
  );
}
