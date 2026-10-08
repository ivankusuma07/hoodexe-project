'use client';

import { useEffect } from 'react';
import { Providers } from './Providers';
import { Desktop } from './xp/Desktop';

export default function AppShell({ onReady }: { onReady?: () => void }) {
  // Child effects run first, so the desktop has opened its first window by the time this fires.
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <Providers>
      <Desktop />
    </Providers>
  );
}
