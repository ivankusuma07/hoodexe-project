import { ImageResponse } from 'next/og';
import { formatQuote } from '@/components/apps/explore/format';
import { Footer, OG_SIZE, RigorPill, XpFrame, logoDataUrl } from '@/lib/ogCard';
import { getShareToken, plainStatement } from '@/lib/shareToken';

export const alt = 'A coin on hood.exe';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** The /t/0x… link preview: the coin's card in an XP window. */
export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const t = await getShareToken(address);
  if (!t) {
    return new ImageResponse(
      (
        <XpFrame title="Token Detail">
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, color: '#0a246a' }}>A coin on hood.exe</div>
          <div style={{ display: 'flex', marginTop: 16, fontSize: 32, color: '#333' }}>Launch coins backed by theorems on Robinhood Chain.</div>
          <Footer />
        </XpFrame>
      ),
      size,
    );
  }

  const logo = await logoDataUrl(t.logo);
  const line = t.hood && t.statement ? plainStatement(t.statement, 120) : (t.blurb ?? '').slice(0, 120);
  const progress = t.phase > 0 ? 1 : (t.progress ?? 0);

  return new ImageResponse(
    (
      <XpFrame title={`$${t.symbol} — Token Detail`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img>
            <img src={logo} width={150} height={150} alt="" style={{ borderRadius: 12, border: '3px solid #7f9db9' }} />
          ) : (
            <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: '#245edc', color: '#fff', fontSize: 84, fontWeight: 700 }}>
              {(t.symbol.trim()[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontSize: 78, fontWeight: 800, color: '#0a246a' }}>${t.symbol.slice(0, 12)}</span>
              {t.hood && <RigorPill score={t.rigorScore} />}
            </div>
            <span style={{ fontSize: 34, color: '#4b4b4b' }}>{t.name.slice(0, 48)}</span>
          </div>
        </div>

        {line && (
          <div style={{ display: 'flex', marginTop: 26, padding: '16px 22px', background: '#fff', border: '2px solid #7f9db9', fontSize: 34, fontStyle: t.hood ? 'italic' : 'normal', color: '#111' }}>
            {line}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 34, marginTop: 26, fontSize: 30, color: '#222' }}>
          {t.marketCap != null && <span>MCap {formatQuote(t.marketCap, t.pairSymbol)}</span>}
          <div style={{ display: 'flex', flex: 1, height: 30, padding: 3, border: '2px solid #686868', borderRadius: 4, background: '#fff' }}>
            <div style={{ display: 'flex', width: `${Math.max(2, Math.round(progress * 100))}%`, background: 'linear-gradient(180deg, #acedad, #2ed330 45%, #26b627)' }} />
          </div>
          <span>{t.phase > 0 ? 'Graduated' : `${Math.floor(progress * 100)}% to graduation`}</span>
        </div>

        <Footer />
      </XpFrame>
    ),
    size,
  );
}
