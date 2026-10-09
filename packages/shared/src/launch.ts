import { z } from 'zod';
import { PONS_METADATA_CAPS } from './abi';
import { STATUS_LABELS } from './rigor';

/** Wizard limits (docs/BRIEF.md §5.2); all sit inside the on-chain byte caps. */
export const LAUNCH_LIMITS = {
  nameMax: 32,
  tickerMin: 2,
  tickerMax: 10,
  statementMax: 280,
  proofMax: 2_000,
  logoBytes: 1_000_000,
} as const;

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a token name.')
  .max(LAUNCH_LIMITS.nameMax, `Use ${LAUNCH_LIMITS.nameMax} characters or fewer.`);

export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]*$/, 'Use letters A–Z and digits 0–9 only.')
  .min(LAUNCH_LIMITS.tickerMin, `Use at least ${LAUNCH_LIMITS.tickerMin} characters.`)
  .max(LAUNCH_LIMITS.tickerMax, `Use ${LAUNCH_LIMITS.tickerMax} characters or fewer.`);

export const statementSchema = z
  .string()
  .trim()
  .min(1, 'Enter a theorem statement.')
  .max(LAUNCH_LIMITS.statementMax, `Keep the statement to ${LAUNCH_LIMITS.statementMax} characters.`);

export const proofSchema = z
  .string()
  .trim()
  .max(LAUNCH_LIMITS.proofMax, `Keep notes to ${LAUNCH_LIMITS.proofMax.toLocaleString('en-US')} characters.`);

const optionalUrl = z
  .string()
  .trim()
  .max(PONS_METADATA_CAPS.social)
  .refine((v) => v === '' || /^https:\/\/\S+$/.test(v), 'Use a full https:// link.');

const handle = z
  .string()
  .trim()
  .max(PONS_METADATA_CAPS.social)
  .refine((v) => v === '' || /^[A-Za-z0-9_@./:-]+$/.test(v), 'Use a handle or link without spaces.');

export const socialsSchema = z.object({
  twitter: handle,
  telegram: handle,
  website: optionalUrl,
});
export type LaunchSocials = z.infer<typeof socialsSchema>;

/** Pinned to IPFS and referenced from the on-chain description. */
export const theoremMetadataSchema = z.object({
  schema: z.literal('hood.exe/theorem@1'),
  name: nameSchema,
  ticker: tickerSchema,
  statement: statementSchema,
  proof: proofSchema,
  rigor: z
    .object({
      score: z.number().int().min(0).max(100),
      wellFormed: z.number().int(),
      status: z.number().int(),
      significance: z.number().int(),
      clarity: z.number().int(),
      statusLabel: z.enum(STATUS_LABELS),
      reasoning: z.string(),
      model: z.string(),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
});
export type TheoremMetadata = z.infer<typeof theoremMetadataSchema>;

const encoder = new TextEncoder();
const byteLength = (s: string) => encoder.encode(s).length;

/** Trim a string to at most `maxBytes` UTF-8 bytes without splitting a character. */
export function truncateBytes(s: string, maxBytes: number): string {
  if (byteLength(s) <= maxBytes) return s;
  let out = '';
  for (const ch of s) {
    if (byteLength(out + ch + '…') > maxBytes) break;
    out += ch;
  }
  return `${out}…`;
}

const SUFFIX = (score: number | null, cid: string) => `\n— launched on hood.exe · rigor ${score ?? '—'}/100 · ipfs://${cid}`;

/**
 * On-chain description (docs/BRIEF.md §5.2):
 *   ∑ {statement}
 *   — launched on hood.exe · rigor {score}/100 · ipfs://{cid}
 * The statement is truncated if needed so the whole string fits Pons's description cap; IPFS keeps the rest.
 */
export function buildDescription(statement: string, score: number | null, cid: string): string {
  const suffix = SUFFIX(score, cid);
  const room = PONS_METADATA_CAPS.description - byteLength(suffix) - byteLength('∑ ');
  return `∑ ${truncateBytes(statement.trim(), room)}${suffix}`;
}

const DESCRIPTION_RE = /^∑ ([\s\S]*)\n— launched on hood\.exe · rigor (\d{1,3}|—)\/100 · ipfs:\/\/(\S+)$/;

/** Recognises a hood.exe launch from its on-chain description. Null for anything else. */
export function parseDescription(description: string): { statement: string; score: number | null; cid: string } | null {
  const m = DESCRIPTION_RE.exec(description);
  if (!m) return null;
  const score = m[2] === '—' ? null : Number(m[2]);
  return { statement: m[1], score: score != null && score <= 100 ? score : null, cid: m[3] };
}
