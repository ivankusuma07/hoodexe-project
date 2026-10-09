'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { LAUNCH_LIMITS } from '@hood/shared';
import { Button } from '@/components/xp/Button';
import { ACCEPTED_LOGOS, logoFileError, type Draft, type Errors } from './draft';
import { Field, invalidProps } from './Field';
import { cropLogo } from './logo';
import styles from './Launch.module.css';

type Props = { draft: Draft; set: (patch: Partial<Draft>) => void; errors: Errors };

export function IdentityPage({ draft, set, errors }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = logoFileError(file);
    setLogoError(err);
    if (err) return;
    setBusy(true);
    try {
      const blob = await cropLogo(file);
      if (draft.logo) URL.revokeObjectURL(draft.logo.url);
      set({ logo: { blob, url: URL.createObjectURL(blob) } });
    } catch (x) {
      setLogoError(x instanceof Error ? x.message : 'Could not read this image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Field label="Token name:" htmlFor="launch-name" error={errors.name} count={[draft.name.length, LAUNCH_LIMITS.nameMax]} hint="Shown on Pons, Blockscout and in wallets.">
        <input
          id="launch-name"
          type="text"
          autoComplete="off"
          maxLength={LAUNCH_LIMITS.nameMax}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Fermat's Last Coin"
          data-autofocus
          {...invalidProps('launch-name', errors.name)}
        />
      </Field>

      <Field label="Ticker:" htmlFor="launch-ticker" error={errors.ticker} count={[draft.ticker.length, LAUNCH_LIMITS.tickerMax]} hint="2–10 letters or digits.">
        <div className={styles.inline}>
          <span className={styles.unit}>$</span>
          <input
            id="launch-ticker"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={LAUNCH_LIMITS.tickerMax}
            value={draft.ticker}
            onChange={(e) => set({ ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
            placeholder="FERMAT"
            {...invalidProps('launch-ticker', errors.ticker)}
          />
        </div>
      </Field>

      <Field label="Logo:" htmlFor="launch-logo" error={logoError ?? errors.logo} hint="PNG, JPG or WebP up to 1 MB. Cropped to a square from the centre.">
        <div className={styles.logoRow}>
          <div className={styles.logoBox}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            {draft.logo ? <img src={draft.logo.url} alt="Logo preview" /> : <span className={styles.placeholder}>none</span>}
          </div>
          <div>
            <input id="launch-logo" ref={fileRef} type="file" accept={ACCEPTED_LOGOS} onChange={onFile} hidden />
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? 'Reading…' : draft.logo ? 'Change…' : 'Browse…'}
            </Button>
          </div>
        </div>
      </Field>
    </>
  );
}
