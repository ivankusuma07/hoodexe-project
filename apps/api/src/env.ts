import { z } from 'zod';

const list = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );

const optional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

/** docs/BRIEF.md §13. Production refuses to start without real secrets; dev runs with stand-ins. */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().default(8787),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: optional,
    RPC_URL_SERVER: optional,
    DEEPSEEK_API_KEY: optional,
    DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
    DEEPSEEK_MODEL: z.string().default('deepseek-v4-flash'),
    PINATA_JWT: optional,
    SESSION_SECRET: z.string().default('dev-only-session-secret-change-me-0000'),
    COOKIE_DOMAIN: optional,
    CORS_ORIGINS: list('http://localhost:3000'),
    /** Envio indexer GraphQL (apps/indexer). Without it, launches are found by scanning RPC logs (local only). */
    ENVIO_GRAPHQL_URL: optional,
    /** Explore's token table sync; 'off' when another process runs it. */
    TOKEN_INDEX: z.enum(['on', 'off']).default('on'),
    TOKEN_INDEX_BACKFILL_BLOCKS: z.coerce.number().int().min(0).default(300_000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of ['REDIS_URL', 'DEEPSEEK_API_KEY', 'PINATA_JWT', 'RPC_URL_SERVER'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required in production' });
    }
    if (env.TOKEN_INDEX === 'on' && !env.ENVIO_GRAPHQL_URL) {
      ctx.addIssue({ code: 'custom', path: ['ENVIO_GRAPHQL_URL'], message: 'required in production (log scanning needs a paid RPC tier)' });
    }
    if (env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.startsWith('dev-only')) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'set a random secret of 32+ characters' });
    }
  });

export type Env = z.output<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // `KEY=` in a .env file (or a blank Railway variable) means unset, so defaults and checks apply.
  // Without this an empty SESSION_SECRET slips past the default and cookie signing breaks.
  const present = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const parsed = envSchema.safeParse(present);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
