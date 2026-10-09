'use client';

import type { TokenDetail } from '@/lib/api';
import styles from './TokenDetail.module.css';

/** Buy/Sell on the Pons curve (docs/BRIEF.md §5.4). */
export function TradePanel({ token }: { token: TokenDetail }) {
  return (
    <div className={styles.panel}>
      <p className={styles.muted}>Buying and selling ${token.symbol} arrives in the next step.</p>
    </div>
  );
}
