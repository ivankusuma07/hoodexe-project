'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { HoodLogo, KeyIcon, RestartIcon, StandByIcon, TurnOffIcon } from './Icons';
import styles from './Power.module.css';

function Panel({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div className={styles.overlay}>
      <div ref={ref} className={styles.panel} role="alertdialog" aria-modal="true" aria-label={title}>
        <div className={styles.head}>
          <span>{title}</span>
          <HoodLogo size={28} />
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.foot}>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type ShutDownProps = {
  onCancel: () => void;
  onStandBy: () => void;
  onTurnOff: () => void;
  onRestart: () => void;
};

export function ShutDownDialog({ onCancel, onStandBy, onTurnOff, onRestart }: ShutDownProps) {
  return (
    <Panel title="Turn off hood.exe" onCancel={onCancel}>
      <button type="button" className={styles.choice} onClick={onStandBy}>
        <StandByIcon size={36} />
        Stand By
      </button>
      <button type="button" className={styles.choice} onClick={onTurnOff}>
        <TurnOffIcon size={36} />
        Turn Off
      </button>
      <button type="button" className={styles.choice} onClick={onRestart}>
        <RestartIcon size={36} />
        Restart
      </button>
    </Panel>
  );
}

export function LogOffDialog({ onCancel, onLogOff }: { onCancel: () => void; onLogOff: () => void }) {
  return (
    <Panel title="Log Off hood.exe" onCancel={onCancel}>
      <button type="button" className={styles.choice} onClick={onLogOff}>
        <KeyIcon size={36} />
        Log Off
      </button>
    </Panel>
  );
}

export function OffScreen({ onPowerOn }: { onPowerOn: () => void }) {
  return createPortal(
    <div className={styles.off} role="alert">
      <div className={styles.offText}>It is now safe to turn off your computer.</div>
      <button type="button" className={styles.powerBtn} onClick={onPowerOn} autoFocus>
        <TurnOffIcon size={20} /> Power On
      </button>
    </div>,
    document.body,
  );
}

