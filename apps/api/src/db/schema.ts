import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** docs/BRIEF.md §9. Callouts, reactions and profiles arrive with Callouts.exe in week 3. */

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    wallet: text('wallet').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_wallet_idx').on(t.wallet)],
);

/** Rigor scores keyed by SHA-256 of the normalised statement. Only successful scores are stored. */
export const scores = pgTable('scores', {
  contentHash: text('content_hash').primaryKey(),
  statement: text('statement').notNull(),
  score: integer('score').notNull(),
  parts: jsonb('parts').$type<{ wellFormed: number; status: number; significance: number; clarity: number }>().notNull(),
  statusLabel: text('status_label').notNull(),
  reasoning: text('reasoning').notNull(),
  model: text('model').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const launches = pgTable(
  'launches',
  {
    txHash: text('tx_hash').primaryKey(),
    tokenAddress: text('token_address').notNull().unique(),
    curveAddress: text('curve_address').notNull(),
    creator: text('creator').notNull(),
    pairToken: text('pair_token').notNull(),
    metadataCid: text('metadata_cid'),
    /** Server-side score for the statement, never the number written on-chain by the client. */
    rigorScore: integer('rigor_score'),
    blockNumber: text('block_number').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('launches_creator_idx').on(t.creator)],
);
