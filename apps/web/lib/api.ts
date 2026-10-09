import { z } from 'zod';
import { rigorScoreSchema, type RigorScore, type TheoremMetadata } from '@hood/shared';

/** Typed client for apps/api (docs/BRIEF.md §9). Cookies ride along for the SIWE session. */
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const errorBody = z.object({ error: z.string() });

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>, timeoutMs = 15_000): Promise<T> {
  if (!API_URL) throw new ApiError('The hood.exe API is not configured (NEXT_PUBLIC_API_URL).', 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ApiError('Could not reach the hood.exe API. Check your connection and try again.', 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = errorBody.safeParse(body);
    if (res.status === 401) throw new ApiError('Sign in with your wallet first.', 401);
    if (res.status === 429) throw new ApiError('Too many requests. Wait a minute and try again.', 429);
    throw new ApiError(parsed.success ? parsed.data.error : `The API answered ${res.status}.`, res.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError('The API sent an unexpected response.', res.status);
  return parsed.data;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const sessionSchema = z.object({ wallet: z.string() });

/** GET /auth/me: the signed-in wallet, or null without a session. */
export async function currentSession(): Promise<string | null> {
  try {
    return (await request('/auth/me', { method: 'GET' }, sessionSchema)).wallet;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export const siweNonce = () => request('/auth/siwe', { method: 'GET' }, z.object({ nonce: z.string() })).then((r) => r.nonce);

export const verifySiwe = (message: string, signature: string) => request('/auth/siwe', json({ message, signature }), sessionSchema);

export const logout = () => request('/auth/logout', { method: 'POST' }, z.unknown());

/** POST /score-theorem. The server caches by normalised statement; a model failure comes back as score null. */
export function scoreTheorem(name: string, statement: string): Promise<RigorScore> {
  // The server allows 8 s for the model; leave room for the round trip.
  return request('/score-theorem', json({ name, statement }), rigorScoreSchema, 12_000);
}

/** `rigorScore` is the server's score for the statement, which is what the pinned metadata carries. */
const pinnedSchema = z.object({ logoCid: z.string().min(1), metadataCid: z.string().min(1), rigorScore: z.number().int().nullable() });
export type Pinned = z.infer<typeof pinnedSchema>;

/** POST /ipfs: the cropped logo and the theorem metadata JSON, pinned server-side with Pinata. */
export function pinLaunch(logo: Blob, metadata: TheoremMetadata): Promise<Pinned> {
  const form = new FormData();
  form.append('logo', logo, `logo.${logo.type.split('/')[1] ?? 'png'}`);
  form.append('metadata', JSON.stringify(metadata));
  return request('/ipfs', { method: 'POST', body: form }, pinnedSchema, 30_000);
}

/** POST /launches: the server re-reads the receipt, so only the hash is sent. */
export function recordLaunch(txHash: string): Promise<unknown> {
  return request('/launches', json({ txHash }), z.unknown());
}

const tokenItemSchema = z.object({
  token: z.string(),
  curve: z.string(),
  name: z.string(),
  symbol: z.string(),
  logo: z.string(),
  pair: z.object({ address: z.string(), symbol: z.string(), decimals: z.number() }),
  hood: z.boolean(),
  statement: z.string().nullable(),
  blurb: z.string().nullable(),
  rigorScore: z.number().nullable(),
  phase: z.number(),
  price: z.number().nullable(),
  marketCap: z.number().nullable(),
  progress: z.number().nullable(),
  launchedAt: z.string(),
  stateUpdatedAt: z.string().nullable(),
});
export type TokenItem = z.infer<typeof tokenItemSchema>;

const tokenPageSchema = z.object({ items: z.array(tokenItemSchema), total: z.number(), hoodCount: z.number(), offset: z.number() });
export type TokenPage = z.infer<typeof tokenPageSchema>;

export type TokenQuery = { tab: 'all' | 'hood'; sort: 'latest' | 'mcap' | 'rigor'; limit: number; offset: number };

/** GET /tokens: Explore's grid. */
export function fetchTokens(q: TokenQuery): Promise<TokenPage> {
  const params = new URLSearchParams({ tab: q.tab, sort: q.sort, limit: String(q.limit), offset: String(q.offset) });
  return request(`/tokens?${params}`, { method: 'GET' }, tokenPageSchema);
}

const tokenDetailSchema = tokenItemSchema.extend({ deployer: z.string(), description: z.string(), metadataCid: z.string().nullable() });
export type TokenDetail = z.infer<typeof tokenDetailSchema>;

/** GET /tokens/:address */
export function fetchToken(address: string): Promise<TokenDetail> {
  return request(`/tokens/${encodeURIComponent(address)}`, { method: 'GET' }, tokenDetailSchema);
}
