'use client';

import { useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { Button } from '@/components/xp/Button';
import { ConnectWallet } from '@/components/xp/ConnectWallet';
import { InfoIcon, PortfolioIcon } from '@/components/xp/Icons';
import { useIdentity } from '@/lib/identity';
import { openApp } from '@/lib/openApp';
import styles from './apps.module.css';

export function Portfolio() {
  const { connected, address, label } = useIdentity();
  const balance = useBalance({ address, query: { enabled: connected } });

  if (!connected) {
    return (
      <div className={`${styles.pane} ${styles.center}`} style={{ justifyContent: 'center' }}>
        <PortfolioIcon size={48} />
        <p style={{ margin: 0 }}>Connect a wallet to see your launches and holdings.</p>
        <ConnectWallet large />
      </div>
    );
  }

  return (
    <div className={styles.pane}>
      <table className={styles.infoTable}>
        <tbody>
          <tr>
            <th scope="row">Wallet:</th>
            <td className={styles.balance}>{label}</td>
          </tr>
          <tr>
            <th scope="row">ETH balance:</th>
            <td className={styles.balance}>
              {balance.data ? `${Number(formatEther(balance.data.value)).toFixed(5)} ETH` : balance.isError ? 'unavailable' : '…'}
            </td>
          </tr>
        </tbody>
      </table>
      <div className={styles.tip} style={{ marginTop: 12 }}>
        <InfoIcon size={16} />
        <p>You don&apos;t have any coins yet.</p>
      </div>
      <Button variant="primary" onClick={() => openApp('launch')}>
        ▶ Launch a Coin
      </Button>
    </div>
  );
}
