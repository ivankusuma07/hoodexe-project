import { afterEach, describe, expect, it, vi } from 'vitest';
import { envioClient, minuteLimiter } from './services/envio';

afterEach(() => vi.unstubAllGlobals());

describe('minuteLimiter', () => {
  it('lets n requests start per 60 s and makes the next one wait', async () => {
    let t = 0;
    const waits: number[] = [];
    const slot = minuteLimiter(3, () => t, async (ms) => {
      waits.push(ms);
      t += ms;
    });
    for (let i = 0; i < 3; i++) await slot();
    expect(waits).toEqual([]);
    t = 10_000;
    await slot(); // the 4th waits until the 1st is a minute old
    expect(waits).toHaveLength(1);
    expect(t).toBeGreaterThanOrEqual(60_000);
  });
});

describe('envioClient', () => {
  it('waits and retries when Envio answers 429', async () => {
    const answers = [
      new Response('', { status: 429, headers: { 'retry-after': '1' } }),
      new Response(JSON.stringify({ data: { chain_metadata: [{ chain_id: 4663, latest_processed_block: 123 }] } }), { status: 200 }),
    ];
    const fetchMock = vi.fn(async () => answers.shift()!);
    vi.stubGlobal('fetch', fetchMock);
    expect(await envioClient('http://envio.test').latestBlock()).toBe(123);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after a few 429s', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429, headers: { 'retry-after': '1' } })));
    await expect(envioClient('http://envio.test').latestBlock()).rejects.toThrow(/429/);
  }, 10_000);
});
