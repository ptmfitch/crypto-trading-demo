# AGENTS.md

This repository is **crypto-trading-demo**: a local paper-trading demo for Bitcoin.
Do not add customer names, client branding, or extra product names to docs or comments.

## Stack

- Next.js 15 (App Router) + React 19 + TailwindCSS 4 + ShadCN/UI
- Prisma + local Postgres (Homebrew `postgresql@16`, database `crypto_trading_demo`)
- SQLite `prisma/dev.db` is the sample snapshot and the before-test provider, not the database the dev server uses
- NextAuth v5 **credentials** provider only (email + password)

Do **not** add MongoDB, Docker, Stripe, or OAuth (including Google). Keep auth as credentials NextAuth.

## Preferred local setup

```bash
npm install
brew services start postgresql@16
createdb crypto_trading_demo
npm run db:generate
npx prisma migrate deploy
npm run db:load-demo
npm run dev
```

`npm run db:load-demo` copies `prisma/dev.db` into Postgres the first time the database is empty. `npm run db:load-demo -- --replace` reloads that snapshot. Homebrew trust auth requires the OS user in the URL (`whoami`). Do not commit `.env`.

Optional `.env`:

```env
DATABASE_URL="postgresql://USER@127.0.0.1:5432/crypto_trading_demo"
AUTH_SECRET="dev-secret-change-me"
NEXTAUTH_URL="http://localhost:3000"
```

SQLite before tests (disposable file, not `prisma/dev.db`):

```bash
npm run test:sqlite
```

Postgres tests load the sample snapshot, check user/wallet/trade counts and balances, then run the same behavior:

```bash
npm run test:postgres
```

CoinGecko is optional. The app proxies BTC price through `/api/btc-price`. If CoinGecko is unreachable, the dashboard may fail to load live prices — do not add another market-data vendor.

## Project map

- `src/app/` — App Router pages (`/dashboard`, `/profile`, `/login`, `/register`)
- `src/actions/` — server actions for credentials auth and trades
- `src/auth.ts` — NextAuth credentials config
- `prisma/schema.prisma` — Postgres models (`User`, `Wallet`, `Trade`)
- `prisma/schema.sqlite.prisma` — same models for the SQLite before tests and verify-tradesim
- `prisma/dev.db` — sample snapshot loaded into local Postgres

## Working rules

- Keep changes small and demo-safe.
- Do not introduce Mongo, Docker, Stripe, OAuth, or extra paid SaaS dependencies.
- New users start with a $10,000 USDT paper wallet.
