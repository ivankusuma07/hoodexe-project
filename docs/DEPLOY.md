# Deploying hood.exe

Plan (agreed 9 Oct 2026): deploy the real production setup about a week early, on its final domains, and use
it unannounced for the house tokens and one real launch and trade. On launch day nothing is redeployed; the
link is announced. Staging and mainnet are the same chain (4663) and the same Pons contracts, so there is no
separate staging network to maintain.

```
hood.fun (Vercel, apps/web) ──HTTPS + cookie──▶ api.hood.fun (Railway: api) ──▶ Postgres, Redis (Railway)
                             ◀──── /ws ───────                ▲                    ▲
                                                Railway: worker ┘── Redis pub/sub ──┘
                     api + worker ──GraphQL──▶ Envio hosted (apps/indexer)
                     api ──eth_call──▶ Alchemy (RPC_URL_SERVER)
```

## Before you start: what Bix provides

| What | Used for |
| --- | --- |
| Domain (`hood.fun` in the brief) with DNS access | Web on the apex, API on `api.` |
| Vercel | `apps/web`. The repo is already linked to a Vercel project named `hood-exe`. |
| Railway | API, worker, Postgres, Redis |
| Envio account + the Envio Deployments GitHub app on this repo | Hosted indexer |
| Alchemy (Robinhood Chain) | Two keys: a server key for the API and a separate, domain-restricted key for browsers |
| DeepSeek API key (topped up) | Rigor scoring and callout moderation |
| Pinata JWT + a dedicated gateway | Pinning launch metadata; serving logos |
| Reown (WalletConnect) project id | WalletConnect and mobile wallets in the connect dialog |
| `OFFICIAL_WALLETS` | Wallets shown as official in Callouts |

## Why the web and the API must share a domain

Sign-in sets an httpOnly session cookie with `SameSite=Lax` on `COOKIE_DOMAIN=.hood.fun`. Browsers only send it
on the web app's API calls when both are on the same site (`hood.fun` and `api.hood.fun`). On the default
`*.vercel.app` and `*.up.railway.app` hosts, signing in silently fails: Launch, Callouts and reactions break.

Sign-in also only accepts messages for hosts in the API's `CORS_ORIGINS`. Vercel preview deployments can
browse, but can't sign in unless their host is added there and shares the cookie domain.

## 1. Indexer: Envio hosted

1. In Envio, create a deployment from this GitHub repo: root directory `apps/indexer`, config `config.yaml`
   (it starts at the V2 factory's deployment block, 26,841,846).
2. Wait for it to sync to the chain head. Note its GraphQL URL; it becomes `ENVIO_GRAPHQL_URL`.
3. Check that uint256 amounts arrive as strings. Locally Hasura runs with
   `HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true`; if the hosted endpoint returns them as JSON numbers, amounts
   above 2^53 lose precision. Query it with
   `{ Trade(limit: 1, order_by: {quoteAmount: desc}) { quoteAmount } }`. The value must be quoted. If it isn't, ask
   Envio to enable the setting before going further.

## 2. API and worker: Railway

1. New project → add **Postgres** and **Redis**.
2. **api** service, from this GitHub repo:
   - Settings → Config file path: `apps/api/railway.json` (Dockerfile build, `/health` check, restart on failure).
   - One replica. The API also keeps Explore's token table in sync in-process. If it ever runs more than one
     replica, set `TOKEN_INDEX=off` on all but one.
   - Networking → custom domain `api.hood.fun`.
3. **worker** service, same repo, config file path `apps/api/railway.worker.json`. It posts system callouts and
   has no public port.
4. Variables. Put these in Railway's shared variables so both services get them:

   ```bash
   NODE_ENV=production                       # set by the image; listed for clarity
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   RPC_URL_SERVER=https://robinhood-mainnet.g.alchemy.com/v2/<server key>
   ENVIO_GRAPHQL_URL=<from step 1>
   DEEPSEEK_API_KEY=
   PINATA_JWT=
   SESSION_SECRET=<openssl rand -hex 32>
   COOKIE_DOMAIN=.hood.fun
   CORS_ORIGINS=https://hood.fun,https://www.hood.fun
   OFFICIAL_WALLETS=0x…,0x…
   BLOCKLIST_EXTRA=
   ```

   The API refuses to start in production without Redis, DeepSeek, Pinata, the RPC, the indexer, or a real
   session secret, and says which one is missing. Migrations run on start. The API and the worker take turns
   on a Postgres lock, so deploying both at once is safe.

To build and run the image locally:

```bash
docker build -f apps/api/Dockerfile -t hood-api .
docker run --env-file apps/api/.env -e NODE_ENV=production -p 8787:8787 hood-api
```

## 3. Web: Vercel

1. Project `hood-exe` → Settings → Build & Deployment → **Root Directory `apps/web`**. Framework: Next.js; keep the
   default install and build commands.
2. Environment variable `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel installs with the repo's pinned pnpm 11.
3. Production environment variables:

   ```bash
   NEXT_PUBLIC_API_URL=https://api.hood.fun
   NEXT_PUBLIC_WS_URL=wss://api.hood.fun/ws
   NEXT_PUBLIC_RPC_URL=https://robinhood-mainnet.g.alchemy.com/v2/<browser key, restricted to hood.fun>
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
   NEXT_PUBLIC_PINATA_GATEWAY=https://<gateway>.mypinata.cloud
   ```

   Never set `NEXT_PUBLIC_DEV_WALLET` here. `NEXT_PUBLIC_*` values ship to every browser, so never reuse the
   server's RPC key. PostHog isn't wired in yet, so its variables do nothing for now.
4. Domains → `hood.fun` (and `www.hood.fun` redirecting to it).

## 4. Smoke test (before the first real launch)

- [ ] `https://api.hood.fun/health` answers `{"ok":true,"db":true,"kv":true}`.
- [ ] Explore lists recent Pons coins (indexer + RPC), and Token Detail shows a chart and trades.
- [ ] Callouts header shows LIVE. With two browsers open, a callout posted in one appears in the other within
      a second (Redis pub/sub + `/ws`).
- [ ] Sign in from a wallet holding a little ETH on 4663, post a callout, react, set a nickname. The session
      survives a reload.
- [ ] Rigor scoring returns a coloured score (DeepSeek), not the grey unscored badge.
- [ ] The risk dialog appears before the first trade or launch, once per browser.
- [ ] A small buy and sell on an existing coin, then Portfolio shows the coin with a cost basis and P&L.
- [ ] Launch a house token from the wizard: the logo and theorem load from the Pinata gateway, it appears in
      Explore and Portfolio, and the worker posts "$TICKER launched".
- [ ] On a phone: windows open full-screen, the taskbar clears the home indicator, and typing doesn't zoom.

## Rolling back

Railway → service → Deployments → redeploy the previous build. Vercel → Deployments → Instant Rollback.
Migrations only add tables and columns, so the previous API build runs against the newer schema.

## Still open before mainnet

- Legal texts are drafts (`LEGAL_DRAFT` in `apps/web/components/apps/legal/Legal.tsx`). They need a lawyer's
  review and a contact address; then set the flag to `false`.
- Geo-blocking: Bix to decide.
