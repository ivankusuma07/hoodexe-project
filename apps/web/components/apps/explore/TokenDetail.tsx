'use client';

import { useQuery } from '@tanstack/react-query';
import { RIGOR_DISCLAIMER, addressUrl, shortAddress } from '@hood/shared';
import { Button } from '@/components/xp/Button';
import { ProgressBar } from '@/components/xp/Controls';
import { InfoIcon } from '@/components/xp/Icons';
import { Latex } from '@/components/xp/Latex';
import { RigorBadge } from '@/components/xp/RigorBadge';
import { ApiError, fetchToken } from '@/lib/api';
import { ipfsUrl } from '@/lib/ipfs';
import type { WindowState } from '@/store/windows';
import { PHASE_LABEL, formatPercent, formatQuote, timeAgo } from './format';
import { TokenLogo } from './TokenLogo';
import appStyles from '../apps.module.css';
import styles from './Explore.module.css';

/**
 * Token Detail, first cut: what the index knows about one coin. Chart, trades, buy/sell and callouts
 * arrive with week 3 (docs/BRIEF.md §5.4).
 */
export function TokenDetail({ win }: { win: WindowState }) {
  const address = win.props?.address ?? '';
  const q = useQuery({
    queryKey: ['token', address.toLowerCase()],
    queryFn: () => fetchToken(address),
    enabled: !!address,
    refetchInterval: win.minimized ? false : 15_000,
  });

  if (q.isPending) return <p className={styles.empty}>Loading…</p>;
  if (q.isError) {
    return (
      <div className={styles.empty}>
        <p>{q.error instanceof ApiError ? q.error.message : 'Could not load this token.'}</p>
        <a href={addressUrl(address)} target="_blank" rel="noopener noreferrer">
          View on Blockscout
        </a>
      </div>
    );
  }

  const t = q.data;
  const metadata = t.metadataCid ? ipfsUrl(t.metadataCid) : null;
  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <TokenLogo logo={t.logo} symbol={t.symbol} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>${t.symbol}</h3>
          <p>{t.name}</p>
        </div>
        {t.hood && <RigorBadge score={t.rigorScore} />}
      </div>

      <div className={styles.theorem}>
        {t.hood && t.statement ? <Latex source={t.statement} /> : <span className={styles.description}>{t.description || 'No description.'}</span>}
      </div>
      {t.hood && <p className={appStyles.fineprint}>Rigor score: {RIGOR_DISCLAIMER}.</p>}

      <div className={styles.curveLabel}>
        <span>{t.phase === 0 ? `Curve ${formatPercent(t.progress)} → Uniswap V4` : PHASE_LABEL[t.phase]}</span>
        {t.stateUpdatedAt && <span className={appStyles.fineprint} style={{ margin: 0 }}>updated {timeAgo(t.stateUpdatedAt)}</span>}
      </div>
      <ProgressBar value={(t.progress ?? 0) * 100} label="Graduation progress" />

      <table className={styles.facts}>
        <tbody>
          <tr>
            <th scope="row">Price:</th>
            <td>{formatQuote(t.price, t.pair.symbol)}</td>
          </tr>
          <tr>
            <th scope="row">Market cap:</th>
            <td>{formatQuote(t.marketCap, t.pair.symbol)}</td>
          </tr>
          <tr>
            <th scope="row">Pair asset:</th>
            <td>{t.pair.symbol}</td>
          </tr>
          <tr>
            <th scope="row">Launched:</th>
            <td>
              {timeAgo(t.launchedAt)} by <span className={styles.mono}>{shortAddress(t.deployer)}</span>
              {t.hood && ' on hood.exe'}
            </td>
          </tr>
          <tr>
            <th scope="row">Token:</th>
            <td className={styles.mono}>{t.token}</td>
          </tr>
        </tbody>
      </table>

      <div className={appStyles.tip}>
        <InfoIcon size={16} />
        <p>Chart, trades and buy/sell arrive in the next build.</p>
      </div>

      <div className={styles.links}>
        <Button onClick={() => window.open(addressUrl(t.token), '_blank', 'noopener')}>Blockscout</Button>
        {metadata && <Button onClick={() => window.open(metadata, '_blank', 'noopener')}>Theorem on IPFS</Button>}
      </div>
    </div>
  );
}
