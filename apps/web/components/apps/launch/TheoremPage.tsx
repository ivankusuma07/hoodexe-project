'use client';

import { LAUNCH_LIMITS, RIGOR_DISCLAIMER, RIGOR_RUBRIC } from '@hood/shared';
import { Button } from '@/components/xp/Button';
import { GroupBox } from '@/components/xp/Controls';
import { Latex } from '@/components/xp/Latex';
import { RigorBadge } from '@/components/xp/RigorBadge';
import { currentRigor, type Draft, type Errors } from './draft';
import { Field, invalidProps } from './Field';
import styles from './Launch.module.css';

type Props = {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  errors: Errors;
  scoring: boolean;
  scoreError?: string;
  onScore: () => void;
};

const STATUS_TEXT = {
  proven: 'Proven result',
  conjecture: 'Open conjecture',
  false: 'False as stated',
  ill_posed: 'Ill-posed',
  not_math: 'Not mathematics',
} as const;

export function TheoremPage({ draft, set, errors, scoring, scoreError, onScore }: Props) {
  const rigor = currentRigor(draft);
  const scored = rigor != null;

  return (
    <>
      <Field
        label="Theorem statement:"
        htmlFor="launch-statement"
        error={errors.statement}
        count={[draft.statement.length, LAUNCH_LIMITS.statementMax]}
        hint={
          <>
            Wrap maths in <code>$…$</code>, e.g. <code>For $n &gt; 2$, $x^n + y^n = z^n$ has no positive integer solutions.</code>
          </>
        }
      >
        <textarea
          id="launch-statement"
          rows={3}
          maxLength={LAUNCH_LIMITS.statementMax}
          value={draft.statement}
          onChange={(e) => set({ statement: e.target.value })}
          spellCheck={false}
          data-autofocus
          {...invalidProps('launch-statement', errors.statement)}
        />
      </Field>

      <div className={styles.field}>
        <div className={styles.labelRow}>Preview:</div>
        <div className={styles.preview} aria-live="polite">
          {draft.statement.trim() ? <Latex source={draft.statement} /> : <span className={styles.placeholder}>Your theorem appears here.</span>}
        </div>
      </div>

      <Field
        label="Proof sketch / notes (optional):"
        htmlFor="launch-proof"
        error={errors.proof}
        count={[draft.proof.length, LAUNCH_LIMITS.proofMax]}
        hint="Stored on IPFS with the coin, not on-chain."
      >
        <textarea
          id="launch-proof"
          rows={3}
          maxLength={LAUNCH_LIMITS.proofMax}
          value={draft.proof}
          onChange={(e) => set({ proof: e.target.value })}
          {...invalidProps('launch-proof', errors.proof)}
        />
      </Field>

      <GroupBox label="Rigor score">
        <div className={styles.rigor}>
          <RigorBadge score={rigor?.score} />
          <div>
            {scoring ? (
              <p className={styles.hint}>Scoring…</p>
            ) : scored && rigor.score != null ? (
              <>
                <b>{rigor.statusLabel ? STATUS_TEXT[rigor.statusLabel] : 'Scored'}</b>
                {rigor.parts && (
                  <div className={styles.rigorParts}>
                    <span>Well-formed {rigor.parts.wellFormed}/{RIGOR_RUBRIC.wellFormed}</span>
                    <span>Status {rigor.parts.status}/{RIGOR_RUBRIC.status}</span>
                    <span>Significance {rigor.parts.significance}/{RIGOR_RUBRIC.significance}</span>
                    <span>Clarity {rigor.parts.clarity}/{RIGOR_RUBRIC.clarity}</span>
                  </div>
                )}
                {rigor.reasoning && <p className={styles.reasoning}>{rigor.reasoning}</p>}
              </>
            ) : scored ? (
              <p className={styles.hint}>The scorer could not grade this statement. You can still launch; the score shows as “—” and you can re-score later from the coin&apos;s Theorem tab.</p>
            ) : (
              <p className={styles.hint}>Scored automatically when you click Next.</p>
            )}
            {scoreError && <p className={styles.error}>{scoreError}</p>}
            <p className={styles.hint}>{RIGOR_DISCLAIMER}.</p>
          </div>
          <Button onClick={onScore} disabled={scoring || !draft.statement.trim() || !!errors.statement}>
            {scored ? 'Re-score' : 'Score now'}
          </Button>
        </div>
      </GroupBox>
    </>
  );
}
