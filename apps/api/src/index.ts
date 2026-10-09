import { Redis } from 'ioredis';
import { buildApp } from './app';
import { connectPostgres } from './db';
import { loadEnv } from './env';
import { memoryKv, redisKv } from './kv';
import { rpcChainReader } from './services/chain';
import { devPinner, pinataPinner } from './services/pinner';
import { deepseekScorer, offlineScorer } from './services/scorer';
import { rpcLaunchSource, tokenIndex } from './services/tokenIndex';

const env = loadEnv();
const { db, close: closeDb } = await connectPostgres(env.DATABASE_URL);
const kv = env.REDIS_URL ? redisKv(new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 })) : memoryKv();

const app = await buildApp({
  env,
  db,
  kv,
  chain: rpcChainReader(env.RPC_URL_SERVER),
  scorer: env.DEEPSEEK_API_KEY
    ? deepseekScorer({ apiKey: env.DEEPSEEK_API_KEY, baseURL: env.DEEPSEEK_BASE_URL, model: env.DEEPSEEK_MODEL, log: (m) => console.warn(m) })
    : offlineScorer,
  pinner: env.PINATA_JWT ? pinataPinner(env.PINATA_JWT) : devPinner(),
});

const standIns = [!env.REDIS_URL && 'in-memory KV', !env.DEEPSEEK_API_KEY && 'offline scorer', !env.PINATA_JWT && 'dev pinner (nothing published)'].filter(Boolean);
if (standIns.length) app.log.warn(`Running with stand-ins: ${standIns.join(', ')}`);

const index =
  env.TOKEN_INDEX === 'rpc'
    ? tokenIndex(db, rpcLaunchSource(env.RPC_URL_SERVER), {
        backfillBlocks: env.TOKEN_INDEX_BACKFILL_BLOCKS,
        chunkBlocks: 500_000,
        refreshRecent: 300,
        log: (m) => app.log.warn(m),
      })
    : null;
index?.start();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    index?.stop();
    await app.close();
    await Promise.all([closeDb(), kv.close()]);
    process.exit(0);
  });
}

await app.listen({ host: env.HOST, port: env.PORT });
