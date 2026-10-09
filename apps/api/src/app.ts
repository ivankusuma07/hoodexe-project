import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { and, eq, gt, sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import type { Address } from 'viem';
import { schema, type Db } from './db';
import type { Env } from './env';
import type { Kv } from './kv';
import type { ChainReader } from './services/chain';
import type { Pinner } from './services/pinner';
import type { Scorer } from './services/scorer';
import { authRoutes } from './routes/auth';
import { ipfsRoutes } from './routes/ipfs';
import { launchRoutes } from './routes/launches';
import { scoreRoutes } from './routes/score';

export type Deps = {
  env: Env;
  db: Db;
  kv: Kv;
  scorer: Scorer;
  pinner: Pinner;
  chain: ChainReader;
  now?: () => Date;
};

export const SESSION_COOKIE = 'hood_session';

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps & { now: () => Date };
    requireSession: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    wallet: Address | null;
  }
}

/** An error whose message is safe to show the user. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export async function buildApp(deps: Deps) {
  const { env } = deps;
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
    // Railway terminates TLS in front of us; client IPs (rate limits) come from X-Forwarded-For.
    trustProxy: env.NODE_ENV === 'production',
    bodyLimit: 64 * 1024,
  });

  app.decorate('deps', { ...deps, now: deps.now ?? (() => new Date()) });
  app.decorateRequest('wallet', null);

  await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true });
  await app.register(cookie, { secret: env.SESSION_SECRET });

  app.decorate('requireSession', async (req: FastifyRequest) => {
    const signed = req.cookies[SESSION_COOKIE];
    const unsigned = signed ? req.unsignCookie(signed) : null;
    if (!unsigned?.valid || !unsigned.value) throw new HttpError(401, 'Sign in with your wallet first.');
    const [row] = await deps.db
      .select({ wallet: schema.sessions.wallet })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, unsigned.value), gt(schema.sessions.expiresAt, app.deps.now())))
      .limit(1);
    if (!row) throw new HttpError(401, 'Your session expired. Sign in again.');
    req.wallet = row.wallet as Address;
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.message });
    if (err instanceof ZodError) return reply.code(400).send({ error: err.issues[0]?.message ?? 'Invalid request.' });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error(err);
    return reply.code(500).send({ error: 'Something went wrong on our side.' });
  });

  app.get('/health', async () => {
    const [db, kv] = await Promise.all([
      deps.db.execute(sql`select 1`).then(
        () => true,
        () => false,
      ),
      deps.kv.ping().catch(() => false),
    ]);
    return { ok: db && kv, db, kv };
  });

  await app.register(authRoutes);
  await app.register(scoreRoutes);
  await app.register(ipfsRoutes);
  await app.register(launchRoutes);
  return app;
}
