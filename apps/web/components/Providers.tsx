'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, type DisclaimerComponent } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '@/lib/wagmi';
import { xpRainbowTheme } from '@/lib/rainbowTheme';

const Disclaimer: DisclaimerComponent = ({ Text }) => (
  <Text>hood.exe is non-custodial software. Your keys never leave your wallet. Not affiliated with Robinhood Markets, Inc.</Text>
);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={xpRainbowTheme}
          modalSize="compact"
          appInfo={{ appName: 'hood.exe', disclaimer: Disclaimer }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
