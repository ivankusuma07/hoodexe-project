'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDisconnect } from 'wagmi';
import { APPS, isAppId, type AppId } from '@/components/apps/meta';
import { APP_COMPONENTS } from '@/components/apps';
import { logout } from '@/lib/api';
import { openApp } from '@/lib/openApp';
import { useWindows } from '@/store/windows';
import { DesktopIcons } from './DesktopIcons';
import { MessageBox } from './Dialog';
import { BOOT_MS, BootScreen, WELCOME_MS, WelcomeScreen } from './Boot';
import { LogOffDialog, OffScreen, ShutDownDialog } from './Power';
import { StartMenu } from './StartMenu';
import { Taskbar } from './Taskbar';
import { Wallpaper } from './Wallpaper';
import { Window } from './Window';
import styles from './Desktop.module.css';

type Overlay = null | 'shutdown' | 'logoff' | 'standby' | 'off' | 'boot' | 'welcome';

export function Desktop() {
  const windows = useWindows((s) => s.windows);
  const activeId = useWindows((s) => s.activeId);
  const closeAll = useWindows((s) => s.closeAll);
  const { disconnect } = useDisconnect();

  const [selected, setSelected] = useState<AppId | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);

  // First load: open the app named in ?app=, else Welcome.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('app');
    if (useWindows.getState().windows.length === 0) openApp(isAppId(requested) ? requested : 'welcome');
  }, []);

  // Keep the URL pointing at the focused window so links shared on X reopen it.
  useEffect(() => {
    const active = windows.find((w) => w.id === activeId);
    const next = active && active.appId !== 'welcome' ? `/?app=${active.appId}` : '/';
    if (window.location.pathname + window.location.search !== next) window.history.replaceState(null, '', next);
  }, [windows, activeId]);

  const closeStart = useCallback(() => setStartOpen(false), []);
  const cancelOverlay = useCallback(() => setOverlay(null), []);

  // Restart / Power On run boot → welcome → desktop; Log Off skips straight to the welcome screen.
  const startUp = useCallback(
    (withBoot: boolean) => {
      closeAll();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const bootMs = withBoot && !reduced ? BOOT_MS : 0;
      const welcomeMs = reduced ? 300 : WELCOME_MS;
      setOverlay(bootMs ? 'boot' : 'welcome');
      window.setTimeout(() => setOverlay('welcome'), bootMs);
      window.setTimeout(() => {
        setOverlay(null);
        openApp('welcome');
      }, bootMs + welcomeMs);
    },
    [closeAll],
  );
  const boot = useCallback(() => startUp(true), [startUp]);

  const grayscale = overlay === 'shutdown' || overlay === 'logoff';

  return (
    <div className={`${styles.desktop} ${grayscale ? styles.grayscale : ''}`}>
      <Wallpaper />
      <div
        className={styles.workspace}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        <DesktopIcons selected={selected} onSelect={setSelected} />
        {windows.map((win) => {
          const app = APPS[win.appId];
          const Content = APP_COMPONENTS[win.appId];
          return (
            <Window
              key={win.id}
              win={win}
              active={win.id === activeId}
              icon={<app.Icon size={16} />}
              maximizable={app.maximizable !== false}
            >
              <Content win={win} />
            </Window>
          );
        })}
      </div>

      {startOpen && (
        <StartMenu
          onClose={closeStart}
          onLogOff={() => {
            setStartOpen(false);
            setOverlay('logoff');
          }}
          onShutDown={() => {
            setStartOpen(false);
            setOverlay('shutdown');
          }}
        />
      )}

      <Taskbar startOpen={startOpen} onStartToggle={() => setStartOpen((o) => !o)} />

      {overlay === 'shutdown' && (
        <ShutDownDialog
          onCancel={cancelOverlay}
          onStandBy={() => setOverlay('standby')}
          onTurnOff={() => {
            closeAll();
            setOverlay('off');
          }}
          onRestart={boot}
        />
      )}
      {overlay === 'logoff' && (
        <LogOffDialog
          onCancel={cancelOverlay}
          onLogOff={() => {
            // Log Off ends the SIWE session too (docs/BRIEF.md §4.4); the API may be unreachable.
            void logout().catch(() => {});
            disconnect();
            startUp(false);
          }}
        />
      )}
      {overlay === 'standby' && (
        <MessageBox title="Stand By" onClose={cancelOverlay}>
          <p>hood.exe can&apos;t stand by — the chain never sleeps.</p>
          <p>Close windows you aren&apos;t using, or choose Turn Off.</p>
        </MessageBox>
      )}
      {overlay === 'off' && <OffScreen onPowerOn={boot} />}
      {overlay === 'boot' && <BootScreen />}
      {overlay === 'welcome' && <WelcomeScreen />}
    </div>
  );
}
