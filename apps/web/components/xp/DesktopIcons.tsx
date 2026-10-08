'use client';

import { useRef, type KeyboardEvent } from 'react';
import { APPS, DESKTOP_APPS, type AppId } from '@/components/apps/meta';
import { openApp } from '@/lib/openApp';
import styles from './Desktop.module.css';

const DOUBLE_TAP_MS = 400;

export function DesktopIcons({ selected, onSelect }: { selected: AppId | null; onSelect: (id: AppId | null) => void }) {
  const lastTap = useRef<{ id: AppId; t: number } | null>(null);

  // One handler for mouse and touch: a second click/tap on the same icon within 400 ms opens it.
  const onClick = (id: AppId, now: number) => {
    const prev = lastTap.current;
    if (prev && prev.id === id && now - prev.t < DOUBLE_TAP_MS) {
      lastTap.current = null;
      openApp(id);
      return;
    }
    lastTap.current = { id, t: now };
    onSelect(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: AppId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openApp(id);
    }
  };

  return (
    <ul className={styles.icons} aria-label="Desktop">
      {DESKTOP_APPS.map((id) => {
        const app = APPS[id];
        return (
          <li key={id}>
            <button
              type="button"
              className={`${styles.icon} ${selected === id ? styles.selected : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onClick(id, e.timeStamp);
              }}
              onKeyDown={(e) => onKeyDown(e, id)}
              onFocus={() => onSelect(id)}
              aria-label={`${app.label} — double-click to open`}
            >
              <span className={styles.iconImg}>
                <app.Icon size={32} />
              </span>
              <span className={styles.label}>{app.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
