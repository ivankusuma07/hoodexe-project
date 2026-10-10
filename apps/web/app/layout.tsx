import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

// Absolute URLs for link previews: NEXT_PUBLIC_SITE_URL once there's a domain; on Vercel, Next.js otherwise
// falls back to the project's production URL.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: 'hood.exe',
  description: 'Launch coins backed by theorems. Trade on provable rigor. Powered by Robinhood Chain, routed through Pons.',
  applicationName: 'hood.exe',
  openGraph: {
    title: 'hood.exe — Mathematical Superintelligence. On-chain.',
    description: 'Launch coins. Prove theorems. Trade intelligently.',
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
