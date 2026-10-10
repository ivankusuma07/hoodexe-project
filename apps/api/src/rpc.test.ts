import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setup } from './test/helpers';

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx;
let upstream: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  ctx = await setup({ env: { RPC_URL_SERVER: 'https://rpc.example/v2/server-key' } });
  upstream = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { id: unknown } | { id: unknown }[];
    const answer = (c: { id: unknown }) => ({ jsonrpc: '2.0', id: c.id, result: '0x1237' });
    return new Response(JSON.stringify(Array.isArray(body) ? body.map(answer) : answer(body)), { status: 200 });
  });
  vi.stubGlobal('fetch', upstream);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await ctx.close();
});

const rpc = (payload: unknown) => ctx.app.inject({ method: 'POST', url: '/rpc', payload: payload as object });

describe('POST /rpc', () => {
  it('forwards reads to the server RPC and answers with its result', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 7, method: 'eth_chainId', params: [] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ jsonrpc: '2.0', id: 7, result: '0x1237' });
    expect(upstream.mock.calls[0][0]).toBe('https://rpc.example/v2/server-key');
  });

  it('forwards batches in order', async () => {
    const res = await rpc([
      { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber' },
      { jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: '0x0000000000000000000000000000000000000001', data: '0x' }, 'latest'] },
    ]);
    expect(res.json().map((r: { id: number }) => r.id)).toEqual([1, 2]);
  });

  it('refuses writes and unknown methods without calling the provider', async () => {
    for (const method of ['eth_sendRawTransaction', 'eth_sendTransaction', 'debug_traceTransaction', 'anvil_setBalance']) {
      const res = await rpc({ jsonrpc: '2.0', id: 1, method, params: [] });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe(-32601);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('caps batch size and rate-limits per visitor', async () => {
    expect((await rpc(Array.from({ length: 21 }, (_, id) => ({ jsonrpc: '2.0', id, method: 'eth_chainId' })))).statusCode).toBe(400);
    const batch = Array.from({ length: 20 }, (_, id) => ({ jsonrpc: '2.0', id, method: 'eth_chainId' }));
    // About 600 calls a minute: 20-call batches are allowed 30 times.
    for (let i = 0; i < 30; i++) expect((await rpc(batch)).statusCode).toBe(200);
    expect((await rpc(batch)).statusCode).toBe(429);
  });
});
