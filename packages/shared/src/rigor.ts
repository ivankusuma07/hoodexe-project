import { z } from 'zod';

export type RigorTier = 'good' | 'warn' | 'bad' | 'none';

/** Badge colours: green >= 80, orange 60-79, red < 60, grey when unscored. */
export function rigorTier(score: number | null | undefined): RigorTier {
  if (score == null) return 'none';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
}

export const RIGOR_DISCLAIMER = 'AI estimate, not a proof check';

/** Rubric ranges (docs/BRIEF.md §11). */
export const RIGOR_RUBRIC = {
  wellFormed: 25,
  status: 35,
  significance: 25,
  clarity: 15,
} as const;

export const STATUS_LABELS = ['proven', 'conjecture', 'false', 'ill_posed', 'not_math'] as const;
export type StatusLabel = (typeof STATUS_LABELS)[number];

const clampInt = (max: number) =>
  z.coerce
    .number()
    .catch(0)
    .transform((n) => Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0))));

/**
 * The model's JSON, validated and repaired: every part is clamped to its range and the total is
 * recomputed as their sum, so a model that misadds or overshoots can't produce an invalid score.
 */
export const rigorModelOutputSchema = z
  .object({
    well_formed: clampInt(RIGOR_RUBRIC.wellFormed),
    status: clampInt(RIGOR_RUBRIC.status),
    significance: clampInt(RIGOR_RUBRIC.significance),
    clarity: clampInt(RIGOR_RUBRIC.clarity),
    status_label: z.enum(STATUS_LABELS).catch('ill_posed'),
    reasoning: z
      .string()
      .catch('')
      .transform((s) => s.trim().slice(0, 200)),
  })
  .transform((o) => {
    const notMath = o.status_label === 'not_math';
    const parts = {
      wellFormed: o.well_formed,
      status: o.status,
      significance: o.significance,
      clarity: o.clarity,
    };
    let score = parts.wellFormed + parts.status + parts.significance + parts.clarity;
    // Rubric: non-mathematical text scores 0-10.
    if (notMath) score = Math.min(score, 10);
    return { score, parts, statusLabel: o.status_label, reasoning: o.reasoning };
  });

export type RigorBreakdown = z.output<typeof rigorModelOutputSchema>;

/** What /score-theorem returns. `score: null` means the model failed or timed out (grey badge). */
export const rigorScoreSchema = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  parts: z
    .object({
      wellFormed: z.number().int(),
      status: z.number().int(),
      significance: z.number().int(),
      clarity: z.number().int(),
    })
    .nullable(),
  statusLabel: z.enum(STATUS_LABELS).nullable(),
  reasoning: z.string(),
  model: z.string().nullable(),
  cached: z.boolean(),
});

export type RigorScore = z.infer<typeof rigorScoreSchema>;

/** Cache key normaliser: whitespace collapsed, case kept (x and X differ in maths). */
export function normalizeStatement(statement: string): string {
  return statement.replace(/\s+/g, ' ').trim();
}
