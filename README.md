# hood.exe

Token launchpad for Robinhood Chain in a Luna-style desktop. Launches and trades route to Pons V2.

- Spec: [docs/BRIEF.md](docs/BRIEF.md) (v1.0 + v1.1 merged; v1.1 wins on conflicts)
- Original briefs: `hood-exe-dev-brief.md` (v1.0), `hood.exe_developer_briefv1.1.md` (v1.1)

## Layout

```
apps/web/          Next.js 16.4 frontend (Vercel)
packages/shared/   Chain config, Pons V2 addresses, shared helpers
```

`apps/api`, `apps/worker` and `apps/indexer` arrive in week 2.

## Develop

Requires Node 20.9+ and pnpm 11.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # optional: RPC URL, WalletConnect project id
pnpm dev                                       # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm build
```

Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` the wallet modal offers browser-injected and Coinbase wallets only.
