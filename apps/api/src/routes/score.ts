import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { LAUNCH_LIMITS, normalizeStatement, statementSchema, type RigorScore, type StatusLabel } from '@hood/shared';
import { HttpError } from '../app';
import { schema, type Db } from '../db';
import { allow } from '../kv';

const CACHE_DAYS = 30;

const body = z.object({
  name: z.string().trim().max(LAUNCH_LIMITS.nameMax).default(''),
  statement: statementSchema,
});

/** Cache key (docs/BRIEF.md §11): SHA-256 of the statement with whitespace collapsed, case kept. */
export const statementHash = (statement: string) => createHash('sha256').update(normalizeStatement(statement)).digest('hex');

type ScoreRow = typeof schema.scores.$inferSelect;

export const toRigorScore = (row: ScoreRow, cached: boolean): RigorScore => ({
  score: row.score,
  parts: row.parts,
  statusLabel: row.statusLabel as StatusLabel,
  reasoning: row.reasoning,
  model: row.model,
  cached,
});

/** The stored score for a statement, however old; what IPFS metadata and launch records trust. */
export async function storedScore(db: Db, statement: string): Promise<ScoreRow | undefined> {
  const [row] = await db.select().from(schema.scores).where(eq(schema.scores.contentHash, statementHash(statement))).limit(1);
  return row;
}

export async function scoreRoutes(app: FastifyInstance) {
  const { db, kv, scorer } = app.deps;

  app.post('/score-theorem', async (req): Promise<RigorScore> => {
    const { name, statement } = body.parse(req.body);
    const normalized = normalizeStatement(statement);
    const cutoff = app.deps.now().getTime() - CACHE_DAYS * 86_400_000;

    // Cache hits are free; only model calls count against the IP limit (§10: 10/hour).
    const cached = await storedScore(db, normalized);
    if (cached && cached.createdAt.getTime() > cutoff) return toRigorScore(cached, true);
    if (!(await allow(kv, `score:${req.ip}`, 10, 3_600))) throw new HttpError(429, 'Rigor scoring is limited to 10 statements an hour.');

    const result = await scorer.score(name, normalized);
    if (!result) return { score: null, parts: null, statusLabel: null, reasoning: '', model: null, cached: false };

    const row = {
      contentHash: statementHash(normalized),
      statement: normalized,
      score: result.breakdown.score,
      parts: result.breakdown.parts,
      statusLabel: result.breakdown.statusLabel,
      reasoning: result.breakdown.reasoning,
      model: result.model,
      createdAt: app.deps.now(),
    };
    await db.insert(schema.scores).values(row).onConflictDoUpdate({ target: schema.scores.contentHash, set: row });
    return toRigorScore(row, false);
  });
}
