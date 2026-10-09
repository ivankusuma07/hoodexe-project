'use client';

import { APPS, type AppId } from './meta';
import { Button } from '@/components/xp/Button';
import { ProgressBar } from '@/components/xp/Controls';
import { useWindows, type WindowState } from '@/store/windows';
import styles from './apps.module.css';

/** Setup-style placeholder for programs that land in later build weeks (docs/BRIEF.md §14). */
const PLANNED: Partial<Record<AppId, { week: number; progress: number; features: string[] }>> = {
  callouts: {
    week: 3,
    progress: 10,
    features: [
      'Live market calls with 🚀 👀 💀 reactions',
      'System callouts for launches, graduations and big buys',
      'Tray balloons when the window is closed',
    ],
  },
};

export function ComingSoon({ win }: { win: WindowState }) {
  const app = APPS[win.appId];
  const plan = PLANNED[win.appId];
  return (
    <>
      <div className={styles.setup}>
        <div className={styles.setupSide}>
          <app.Icon size={48} />
          <b>{app.label}</b>
        </div>
        <div className={styles.setupMain}>
          <h3>Setup is preparing {app.label}…</h3>
          <p>This program is still being installed on hood.exe.</p>
          {plan && (
            <>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <ProgressBar value={plan.progress} label="Install progress" />
              <p className={styles.fineprint}>Scheduled for build week {plan.week}.</p>
            </>
          )}
        </div>
      </div>
      <div className={styles.footerRow} style={{ borderTop: '1px solid #d6d2c2' }}>
        <Button disabled>&lt; Back</Button>
        <Button disabled>Next &gt;</Button>
        <Button onClick={() => useWindows.getState().close(win.id)}>Cancel</Button>
      </div>
    </>
  );
}
