'use client';

import { useState } from 'react';
import { RISK_POINTS } from '@/components/apps/legal/Legal';
import { openApp } from '@/lib/openApp';
import { useRisk } from '@/lib/risk';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { WarningIcon } from './Icons';
import styles from './RiskDialog.module.css';

/** The one-time risk disclosure before a first launch or trade (docs/BRIEF.md §5.10); see lib/risk.ts. */
export function RiskDialog() {
  const pending = useRisk((s) => s.pending);
  // Unmounts between requests, so the checkbox starts unticked every time.
  return pending ? <RiskPrompt /> : null;
}

function RiskPrompt() {
  const [checked, setChecked] = useState(false);

  const { accept, dismiss } = useRisk.getState();
  // The dialog is modal, so reading a full document means stepping out of it; the action is dropped.
  const read = (to: 'terms' | 'risk' | 'privacy') => {
    dismiss();
    openApp(to);
  };

  return (
    <Dialog
      title="Before you continue"
      onClose={dismiss}
      width={420}
      footer={
        <>
          <Button variant="primary" disabled={!checked} onClick={accept}>
            I accept
          </Button>
          <Button onClick={dismiss}>Cancel</Button>
        </>
      }
    >
      <div className={styles.head}>
        <WarningIcon size={32} />
        <p>Launching and trading memecoins is highly speculative. Please read this once before your first launch or trade.</p>
      </div>
      <ul className={styles.points}>
        {RISK_POINTS.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      <label className={styles.check}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} data-autofocus />
        <span>
          I understand these risks and agree to the{' '}
          <button type="button" className={styles.link} onClick={() => read('terms')}>
            Terms of Use
          </button>
          .
        </span>
      </label>
      <p className={styles.more}>
        Read the full{' '}
        <button type="button" className={styles.link} onClick={() => read('risk')}>
          Risk disclosure
        </button>{' '}
        and{' '}
        <button type="button" className={styles.link} onClick={() => read('privacy')}>
          Privacy notice
        </button>
        .
      </p>
    </Dialog>
  );
}
