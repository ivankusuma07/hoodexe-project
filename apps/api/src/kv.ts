import type { Redis } from 'ioredis';

/** The slice of Redis the API uses: nonces, rate-limit counters. */
export interface Kv {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Read and delete in one step, so a nonce can only be spent once. */
  take(key: string): Promise<string | null>;
  /** Increment a counter; the TTL starts with the first hit of the window. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function redisKv(redis: Redis): Kv {
  return {
    async set(key, value, ttl) {
      await redis.set(key, value, 'EX', ttl);
    },
    take: (key) => redis.getdel(key),
    async incr(key, ttl) {
      const [[, n]] = (await redis.multi().incr(key).expire(key, ttl, 'NX').exec()) as [[null, number]];
      return n;
    },
    ping: async () => (await redis.ping()) === 'PONG',
    close: async () => void (await redis.quit()),
  };
}

/** Single-process stand-in for dev without Redis and for tests. */
export function memoryKv(now: () => number = Date.now): Kv {
  const store = new Map<string, { value: string; expires: number }>();
  const live = (key: string) => {
    const e = store.get(key);
    if (e && e.expires <= now()) store.delete(key);
    return store.get(key);
  };
  return {
    async set(key, value, ttl) {
      store.set(key, { value, expires: now() + ttl * 1000 });
    },
    async take(key) {
      const e = live(key);
      store.delete(key);
      return e?.value ?? null;
    },
    async incr(key, ttl) {
      const e = live(key);
      const value = String(Number(e?.value ?? 0) + 1);
      store.set(key, { value, expires: e?.expires ?? now() + ttl * 1000 });
      return Number(value);
    },
    ping: async () => true,
    close: async () => {},
  };
}

/** Fixed-window limiter (docs/BRIEF.md §10). True while under the limit. */
export async function allow(kv: Kv, key: string, max: number, windowSeconds: number): Promise<boolean> {
  return (await kv.incr(`rl:${key}`, windowSeconds)) <= max;
}
