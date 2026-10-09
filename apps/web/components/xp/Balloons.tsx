'use client';

import { useEffect } from 'react';
import { shortAddress } from '@hood/shared';
import type { Callout } from '@/lib/api';
import { onLive, startLive } from '@/lib/live';
import { openApp } from '@/lib/openApp';
import { useTray } from '@/store/tray';
import { useWindows } from '@/store/windows';
import { CtrlGlyph } from './Window';
import styles from './Balloons.module.css';

const FADE_MS = 6_000;
const GONE_MS = 8_000;

const calloutsVisible = () => useWindows.getState().windows.some((w) => w.appId === 'callouts' && !w.minimized);

/**
 * Tray balloons (docs/BRIEF.md §5.6). Keeps the page's live link open, and when a callout arrives while
 * Callouts.exe is closed or minimized, raises a balloon from the tray and lights the unread dot.
 */
export function Balloons() {
  const balloons = useTray((s) => s.balloons);
  const windows = useWindows((s) => s.windows);

  useEffect(() => {
    const stop = startLive();
    const off = onLive((e) => {
      if (e.type === 'callout' && !calloutsVisible()) useTray.getState().push(e.callout);
    });
    return () => {
      off();
      stop();
    };
  }, []);

  // Opening (or restoring) Callouts reads everything and clears the balloons.
  const open = windows.some((w) => w.appId === 'callouts' && !w.minimized);
  useEffect(() => {
    if (open) {
      useTray.getState().markRead();
      useTray.getState().clearAll();
    }
  }, [open]);

  if (!balloons.length) return null;
  return (
    <div className={styles.stack} aria-live="polite">
      {balloons.map((b) => (
        <Balloon key={b.id} callout={b} />
      ))}
    </div>
  );
}

function Balloon({ callout: c }: { callout: Callout }) {
  useEffect(() => {
    const t = setTimeout(() => useTray.getState().dismiss(c.id), GONE_MS);
    return () => clearTimeout(t);
  }, [c.id]);

  const who = c.kind === 'system' ? 'hood.exe' : (c.nickname ?? shortAddress(c.wallet));
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.balloon}
      style={{ animationDelay: `${FADE_MS}ms`, animationDuration: `${GONE_MS - FADE_MS}ms` }}
      onClick={() => openApp('callouts')}
      onKeyDown={(e) => e.key === 'Enter' && openApp('callouts')}
    >
      <div className={styles.head}>
        <b>📣 New Callout</b>
        <button
          type="button"
          className={styles.close}
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            useTray.getState().dismiss(c.id);
          }}
        >
          <CtrlGlyph kind="close" />
        </button>
      </div>
      <p className={styles.text}>
        <b>{who}</b>
        {c.ticker ? <span className={styles.ticker}> ${c.ticker}</span> : null}: {c.text.length > 120 ? `${c.text.slice(0, 119)}…` : c.text}
      </p>
    </div>
  );
}
