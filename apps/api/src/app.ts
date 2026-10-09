import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { and, eq, gt, sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import type { Address } from 'viem';
import { schema, type Db } from './db';
import type { Env } from './env';
import type { Kv } from './kv';
import type { ChainReader } from './services/chain';
import type { EnvioClient } from './services/envio';
import type { Moderator } from './services/moderation';
import type { Pinner } from './services/pinner';
import type { PubSub } from './services/pubsub';
import type { Scorer } from './services/scorer';
import { authRoutes } from './routes/auth';
import { calloutRoutes } from './routes/callouts';
import { ipfsRoutes } from './routes/ipfs';
import { launchRoutes } from './routes/launches';
import { liveRoutes } from './routes/live';
import { scoreRoutes } from './routes/score';
import { tokenRoutes } from './routes/tokens';

export type Deps = {
  env: Env;
  db: Db;
  kv: Kv;
  scorer: Scorer;
  pinner: Pinner;
  chain: ChainReader;
  /** The indexer, when ENVIO_GRAPHQL_URL is set: charts, trades, volume. */
  envio?: EnvioClient;
  /** The model step of callout moderation (§10). */
  moderator: Moderator;
  /** Live callouts and reactions, from this process and the worker, to the WebSockets. */
  pubsub: PubSub;
  now?: () => Date;
};

export const SESSION_COOKIE = 'hood_session';

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps & { now: () => Date };
    requireSession: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** The signed-in wallet, or null; for routes that work for everyone. */
    sessionWallet: (req: FastifyRequest) => Promise<Address | null>;
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

  // The default allows GET/HEAD/POST only; PUT /profile needs its preflight to pass too.
  await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PUT'] });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  // Clients only listen on /ws; 1 KB is plenty for anything a browser might send.
  await app.register(websocket, { options: { maxPayload: 1_024 } });

  /** 'none' without a valid signed cookie, 'expired' for an unknown or lapsed session. */
  async function lookupSession(req: FastifyRequest): Promise<Address | 'none' | 'expired'> {
    const signed = req.cookies[SESSION_COOKIE];
    const unsigned = signed ? req.unsignCookie(signed) : null;
    if (!unsigned?.valid || !unsigned.value) return 'none';
    const [row] = await deps.db
      .select({ wallet: schema.sessions.wallet })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, unsigned.value), gt(schema.sessions.expiresAt, app.deps.now())))
      .limit(1);
    return row ? (row.wallet as Address) : 'expired';
  }

  app.decorate('sessionWallet', async (req: FastifyRequest) => {
    const s = await lookupSession(req);
    return s === 'none' || s === 'expired' ? null : s;
  });

  app.decorate('requireSession', async (req: FastifyRequest) => {
    const s = await lookupSession(req);
    if (s === 'none') throw new HttpError(401, 'Sign in with your wallet first.');
    if (s === 'expired') throw new HttpError(401, 'Your session expired. Sign in again.');
    req.wallet = s;
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
  await app.register(tokenRoutes);
  await app.register(calloutRoutes);
  await app.register(liveRoutes);
  return app;
}
