import { EventEmitter } from 'node:events';
import type { Redis } from 'ioredis';

/** Live events between the worker and the API's WebSockets (docs/BRIEF.md §9: Redis pub/sub `callouts`). */
export interface PubSub {
  publish(channel: string, message: unknown): Promise<void>;
  /** Returns an unsubscribe function. */
  subscribe(channel: string, handler: (message: unknown) => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

export const CALLOUTS_CHANNEL = 'callouts';

export function redisPubSub(redis: Redis): PubSub {
  // A subscribed connection can't issue other commands, so subscribers get their own.
  const sub = redis.duplicate();
  const handlers = new Map<string, Set<(message: unknown) => void>>();
  sub.on('message', (channel: string, raw: string) => {
    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    for (const h of handlers.get(channel) ?? []) h(message);
  });
  return {
    async publish(channel, message) {
      await redis.publish(channel, JSON.stringify(message));
    },
    async subscribe(channel, handler) {
      const set = handlers.get(channel) ?? new Set();
      if (!handlers.has(channel)) {
        handlers.set(channel, set);
        await sub.subscribe(channel);
      }
      set.add(handler);
      return async () => {
        set.delete(handler);
      };
    },
    close: async () => void (await sub.quit()),
  };
}

/** Single-process stand-in: the worker and API must share the process (tests, dev without Redis). */
export function memoryPubSub(): PubSub {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);
  return {
    async publish(channel, message) {
      // Round-trip through JSON so subscribers see exactly what Redis would deliver.
      bus.emit(channel, JSON.parse(JSON.stringify(message)));
    },
    async subscribe(channel, handler) {
      bus.on(channel, handler);
      return async () => void bus.off(channel, handler);
    },
    close: async () => void bus.removeAllListeners(),
  };
}
