'use client';

import { useState } from 'react';
import { logoUrl } from '@/lib/ipfs';
import styles from './Explore.module.css';

/** A token's logo, or its ticker's first letter when there's none or it fails to load. */
export function TokenLogo({ logo, symbol, size = 40 }: { logo: string; symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : logoUrl(logo);
  return (
    <span className={styles.logo} style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- third-party logos from IPFS/https, not our assets
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        (symbol.trim()[0] ?? '?').toUpperCase()
      )}
    </span>
  );
}
