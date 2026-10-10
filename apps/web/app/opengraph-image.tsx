import { ImageResponse } from 'next/og';
import { Footer, OG_SIZE, XpFrame } from '@/lib/ogCard';

export const alt = 'hood.exe — Mathematical Superintelligence. On-chain.';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** The site-wide link preview: the Welcome window. */
export default function Image() {
  return new ImageResponse(
    (
      <XpFrame title="Welcome to hood.exe">
        <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 120, fontWeight: 800, fontStyle: 'italic', color: '#0a246a' }}>
          hood<span style={{ color: '#ff6b1a' }}>.</span>exe
        </div>
        <div style={{ display: 'flex', marginTop: 10, fontSize: 52, fontStyle: 'italic', color: '#0a246a' }}>Mathematical Superintelligence. On-chain.</div>
        <div style={{ display: 'flex', marginTop: 26, fontSize: 34, color: '#222' }}>
          Launch coins backed by theorems. Trade on provable rigor. Powered by Robinhood Chain, routed through Pons.
        </div>
        <Footer />
      </XpFrame>
    ),
    size,
  );
}
