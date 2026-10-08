import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://hood.fun'),
  title: 'hood.exe',
  description: 'Launch coins backed by theorems. Trade on provable rigor. Powered by Robinhood Chain, routed through Pons.',
  applicationName: 'hood.exe',
  openGraph: {
    title: 'hood.exe — Mathematical Superintelligence. On-chain.',
    description: 'Launch coins. Prove theorems. Trade intelligently.',
    url: 'https://hood.fun',
    siteName: 'hood.exe',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'hood.exe' },
};

export const viewport: Viewport = {
  themeColor: '#245edc',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
