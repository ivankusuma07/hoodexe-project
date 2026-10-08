'use client';

import { useEffect, useRef } from 'react';
import { useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit';
import { addressUrl, EXPLORER_MAINNET } from '@hood/shared';
import { APPS, START_APPS, type AppId } from '@/components/apps/meta';
import { openApp } from '@/lib/openApp';
import { useIdentity } from '@/lib/identity';
import {
  ExploreIcon,
  HelpIcon,
  HoodLogo,
  InfoIcon,
  KeyIcon,
  PortfolioIcon,
  RecycleBinIcon,
  TurnOffIcon,
  WalletIcon,
} from './Icons';
import styles from './StartMenu.module.css';

type StartMenuProps = {
  onClose: () => void;
  onLogOff: () => void;
  onShutDown: () => void;
};

export function StartMenu({ onClose, onLogOff, onShutDown }: StartMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { connected, label, role, address } = useIdentity();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest('[data-start-button]')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const launch = (id: AppId) => {
    openApp(id);
    onClose();
  };

  return (
    <div ref={ref} className={styles.menu} role="menu" aria-label="Start menu">
      <div className={styles.header}>
        <span className={styles.avatar}>
          <HoodLogo size={40} />
        </span>
        <span className={styles.who}>
          <span className={styles.name}>{label}</span>
          <span className={styles.role}>{role}</span>
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          {START_APPS.map((id) => {
            const app = APPS[id];
            return (
              <button key={id} type="button" role="menuitem" className={styles.item} onClick={() => launch(id)}>
                <app.Icon size={32} />
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{app.label}</span>
                  <span className={styles.desc}>{app.description}</span>
                </span>
              </button>
            );
          })}
          <div className={styles.sep} />
          <button type="button" role="menuitem" className={styles.item} onClick={() => launch('welcome')}>
            <HelpIcon size={32} />
            <span className={styles.itemText}>
              <span className={styles.itemName}>Start Here</span>
              <span className={styles.desc}>{APPS.welcome.description}</span>
            </span>
          </button>
        </div>

        <div className={styles.right}>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              onClose();
              if (connected) openAccountModal?.();
              else openConnectModal?.();
            }}
          >
            <WalletIcon size={24} />
            <span className={styles.itemName}>{connected ? 'My Wallet' : 'Connect Wallet'}</span>
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => launch('portfolio')}>
            <PortfolioIcon size={24} />
            <span className={styles.itemName}>My Coins</span>
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => launch('explore')}>
            <ExploreIcon size={24} />
            <span className={styles.itemName}>All Pons Coins</span>
          </button>
          <div className={styles.sep} />
          <a
            role="menuitem"
            className={styles.item}
            href={address ? addressUrl(address) : EXPLORER_MAINNET}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
          >
            <InfoIcon size={24} />
            <span className={styles.itemName}>Chain Explorer</span>
          </a>
          <button type="button" role="menuitem" className={styles.item} onClick={() => launch('about')}>
            <InfoIcon size={24} />
            <span className={styles.itemName}>About hood.exe</span>
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => launch('recycle')}>
            <RecycleBinIcon size={24} />
            <span className={styles.itemName}>Recycle Bin</span>
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.footerBtn} onClick={onLogOff}>
          <KeyIcon size={22} /> Log Off
        </button>
        <button type="button" className={styles.footerBtn} onClick={onShutDown}>
          <TurnOffIcon size={22} /> Shut Down
        </button>
      </div>
    </div>
  );
}
