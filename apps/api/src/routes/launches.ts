import type { FastifyInstance } from 'fastify';
import { isAddressEqual, isHex, type Hash } from 'viem';
import { z } from 'zod';
import { parseDescription } from '@hood/shared';
import { HttpError } from '../app';
import { schema } from '../db';
import { storedScore } from './score';

const body = z.object({
  txHash: z.string().refine((s) => isHex(s) && s.length === 66, 'Invalid transaction hash.'),
});

/** POST /launches (docs/BRIEF.md §5.2 step 4): re-reads the receipt; nothing from the client is trusted but the hash. */
export async function launchRoutes(app: FastifyInstance) {
  const { db, chain } = app.deps;

  app.post('/launches', { preHandler: app.requireSession }, async (req) => {
    const { txHash } = body.parse(req.body);
    const launch = await chain.launchFromTx(txHash as Hash);
    if (launch === 'pending') throw new HttpError(409, 'The transaction is not confirmed yet.');
    if (!launch) throw new HttpError(400, 'That transaction is not a successful Pons V2 launch.');
    if (!isAddressEqual(launch.deployer, req.wallet!)) throw new HttpError(403, 'That launch belongs to another wallet.');

    const parsed = parseDescription(launch.description);
    const scored = parsed ? await storedScore(db, parsed.statement) : undefined;
    const row = {
      txHash: txHash.toLowerCase(),
      tokenAddress: launch.token,
      curveAddress: launch.curve,
      creator: launch.deployer,
      pairToken: launch.pairToken,
      metadataCid: parsed?.cid ?? null,
      rigorScore: scored?.score ?? null,
      blockNumber: launch.blockNumber.toString(),
    };
    await db.insert(schema.launches).values(row).onConflictDoNothing();
    return { token: row.tokenAddress, curve: row.curveAddress, hoodLaunch: parsed != null, rigorScore: row.rigorScore };
  });
}
