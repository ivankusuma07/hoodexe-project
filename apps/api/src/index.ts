import { Redis } from 'ioredis';
import { buildApp } from './app';
import { connectPostgres } from './db';
import { loadEnv } from './env';
import { memoryKv, redisKv } from './kv';
import { rpcChainReader } from './services/chain';
import { devPinner, pinataPinner } from './services/pinner';
import { deepseekScorer, offlineScorer } from './services/scorer';
import { envioClient, envioLaunchSource } from './services/envio';
import { rpcLaunchSource, tokenIndex } from './services/tokenIndex';

const env = loadEnv();
const { db, close: closeDb } = await connectPostgres(env.DATABASE_URL);
const kv = env.REDIS_URL ? redisKv(new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 })) : memoryKv();

const envio = env.ENVIO_GRAPHQL_URL ? envioClient(env.ENVIO_GRAPHQL_URL) : undefined;

const app = await buildApp({
  env,
  db,
  envio,
  kv,
  chain: rpcChainReader(env.RPC_URL_SERVER),
  scorer: env.DEEPSEEK_API_KEY
    ? deepseekScorer({ apiKey: env.DEEPSEEK_API_KEY, baseURL: env.DEEPSEEK_BASE_URL, model: env.DEEPSEEK_MODEL, log: (m) => console.warn(m) })
    : offlineScorer,
  pinner: env.PINATA_JWT ? pinataPinner(env.PINATA_JWT) : devPinner(),
});

const standIns = [!env.REDIS_URL && 'in-memory KV', !env.DEEPSEEK_API_KEY && 'offline scorer', !env.PINATA_JWT && 'dev pinner (nothing published)'].filter(Boolean);
if (standIns.length) app.log.warn(`Running with stand-ins: ${standIns.join(', ')}`);

const rpcSource = rpcLaunchSource(env.RPC_URL_SERVER);
const index =
  env.TOKEN_INDEX === 'on'
    ? tokenIndex(db, envio ? envioLaunchSource(envio, rpcSource) : rpcSource, {
        backfillBlocks: env.TOKEN_INDEX_BACKFILL_BLOCKS,
        // Envio pages internally; raw log scans are capped by the RPC's response limit.
        chunkBlocks: env.ENVIO_GRAPHQL_URL ? 5_000_000 : 500_000,
        refreshRecent: 300,
        log: (m) => app.log.warn(m),
      })
    : null;
if (index && !env.ENVIO_GRAPHQL_URL) app.log.warn('Token index is scanning RPC logs; set ENVIO_GRAPHQL_URL to use the indexer');
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
