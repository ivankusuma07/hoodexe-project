# hood.exe

Token launchpad for Robinhood Chain in a Luna-style desktop. Launches and trades route to Pons V2.

- Spec: [docs/BRIEF.md](docs/BRIEF.md) (v1.0 + v1.1 merged; v1.1 wins on conflicts)
- Original briefs: `hood-exe-dev-brief.md` (v1.0), `hood.exe_developer_briefv1.1.md` (v1.1)

## Layout

```
apps/web/          Next.js 16.4 frontend (Vercel)
apps/api/          Fastify 5 API: SIWE sessions, rigor scoring, IPFS pinning, launch records (Railway)
packages/shared/   Chain config, Pons V2 ABIs and quote maths, zod schemas, shared helpers
```

`apps/worker` and `apps/indexer` arrive next.

## Develop

Requires Node 20.9+, pnpm 11 and Docker (for the API's Postgres and Redis).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8787
pnpm dev                                       # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` the wallet modal offers browser-injected and Coinbase wallets only.

### API

```bash
docker compose up -d                           # Postgres 17 on :54320, Redis 7 on :63790
cp apps/api/.env.example apps/api/.env
pnpm dev:api                                   # http://localhost:8787, migrations run on start
```

Open the web app on `localhost`, not `127.0.0.1`, so the session cookie reaches the API.

- Without `DEEPSEEK_API_KEY` every statement comes back unscored (grey badge).
- Without `PINATA_JWT` a dev pinner computes CIDs locally and publishes nothing.
- Production refuses to start on either stand-in, without Redis, or with the dev session secret.
- API tests run on in-process Postgres (PGlite) and need no Docker.
- Schema changes: edit `apps/api/src/db/schema.ts`, then `pnpm --filter @hood/api db:generate`.
- Explore's `/tokens` is fed by an interim index inside the API (`TOKEN_INDEX=rpc`, the default): it follows the factory's `TokenLaunched` logs from `TOKEN_INDEX_BACKFILL_BLOCKS` back (300k ≈ 8 h) and refreshes curve state for hood.exe tokens and the 300 newest launches. Envio replaces it; set `TOKEN_INDEX=off` then. It needs a dedicated `RPC_URL_SERVER`: the public RPC starts answering a busy client with Cloudflare challenges.

### Local chain (fork of 4663)

Needs [Foundry](https://getfoundry.sh)'s `anvil` (on PATH, in `~/.foundry/bin`, or `ANVIL=…`).

```bash
pnpm fork             # Robinhood Chain with live Pons V2 on http://127.0.0.1:8545
pnpm fork --refresh   # re-fork mainnet (new launch terms or pair tokens)
```

The public RPC only keeps ~10 minutes of state, so `pnpm fork` forks once, runs every launch path the wizard uses (including a dev buy that fills the curve), saves the state to `.fork/`, and serves that snapshot with no upstream. Each run starts from the snapshot.

To launch from the wizard against it, with no browser wallet needed:

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_DEV_WALLET=1        # adds "Anvil dev wallet" (anvil signs for it); only with a localhost RPC
# apps/api/.env
RPC_URL_SERVER=http://127.0.0.1:8545
```

The four anvil dev accounts get 10,000 ETH and 10,000 USDG each. A real wallet works too: add a network with chain id 4663 and RPC `http://127.0.0.1:8545`, and import an anvil dev key. Blockscout links in the wizard point at mainnet and won't resolve fork transactions.

### Chain checks

Read-only against chain 4663; nothing is sent.

```bash
pnpm --filter @hood/shared check:pons        # addresses, ABIs, launch terms, quote vs. contract
pnpm --filter @hood/shared simulate:launch   # wizard launch txs via eth_call, dev-buy quote vs. fill
pnpm --filter @hood/shared sync:pairs        # regenerate the approved pair-token list
```
