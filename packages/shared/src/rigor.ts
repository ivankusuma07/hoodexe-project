export type RigorTier = 'good' | 'warn' | 'bad' | 'none';

/** Badge colours: green >= 80, orange 60-79, red < 60, grey when unscored. */
export function rigorTier(score: number | null | undefined): RigorTier {
  if (score == null) return 'none';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
}

export const RIGOR_DISCLAIMER = 'AI estimate, not a proof check';
