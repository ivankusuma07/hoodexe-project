import { Redis } from 'ioredis';
import { connectPostgres } from './db';
import { loadEnv } from './env';
import { envioClient } from './services/envio';
import { redisPubSub } from './services/pubsub';
import { systemCalloutsTick } from './systemCallouts';

/**
 * The always-on worker (docs/BRIEF.md §9): every 10 s, system callouts for hood.exe coins. Runs from the
 * API's image as a second Railway service (`pnpm --filter @hood/api worker`). Needs Redis: its callouts
 * reach the API's WebSockets through pub/sub.
 */
const env = loadEnv();
if (!env.REDIS_URL) throw new Error('The worker needs REDIS_URL to reach the API.');
const { db, close } = await connectPostgres(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, family: 0 });
const pubsub = redisPubSub(redis);
// Its share of Envio's per-minute query limit; the API takes 60 (src/index.ts).
const envio = env.ENVIO_GRAPHQL_URL ? envioClient(env.ENVIO_GRAPHQL_URL, 1_000, 20) : undefined;
if (!envio) console.warn('No ENVIO_GRAPHQL_URL: big-buy callouts are off; launches and graduations still post.');

const log = (msg: string) => console.log(`[worker] ${new Date().toISOString()} ${msg}`);
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await systemCalloutsTick({ db, pubsub, envio, now: () => new Date(), log });
  } catch (e) {
    log(`tick failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  } finally {
    running = false;
  }
}

await tick();
const timer = setInterval(tick, 10_000);
log('running every 10 s');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    clearInterval(timer);
    await Promise.all([pubsub.close(), close()]);
    await redis.quit();
    process.exit(0);
  });
}
