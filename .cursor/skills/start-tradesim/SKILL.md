---
name: start-tradesim
description: Pull the latest main branch and start the shared local TradeSim demo (Next.js on port 3000 and local Postgres via Prisma). Use when the user asks to pull the latest, start the app, boot the demo, or start related services for this repository.
---

# Start TradeSim

Start the shared local demo. Port 3000 and the local Postgres database `crypto_trading_demo` belong to that demo. The verification helper (`.cursor/skills/verify-tradesim`) is a different workflow: it uses another port and a disposable sqlite file. Do not launch it here.

Postgres is Homebrew `postgresql@16`. Do not start Docker. If the service is stopped, run `brew services start postgresql@16`.

## Before pulling

From the repo root, check branch, tracking, and working tree.

- Stay on `main` tracking `origin/main` with a clean working tree.
- If the tree is dirty, or the branch is not `main`, stop and report that. Do not stash, reset, or pull.

## Pull

```bash
git pull --ff-only origin main
```

If the pull is not a fast-forward, stop and report the state. Do not merge or rebase.

## Dependencies

Run `npm install` only when `node_modules` is missing, or when the pull changed `package.json` or `package-lock.json`. Otherwise skip it.

## Database

`.env` supplies `DATABASE_URL` and `AUTH_SECRET`. Do not print those values.

`DATABASE_URL` points at local Postgres. Homebrew trust auth needs the OS user in the URL (`whoami`), for example `postgresql://USER@127.0.0.1:5432/crypto_trading_demo`. A URL with no user is rejected.

```bash
createdb crypto_trading_demo
npm run db:generate
npx prisma migrate deploy
npm run db:load-demo
```

Create the database once. `migrate deploy` applies `prisma/migrations`. `db:load-demo` copies the sample rows from `prisma/dev.db` when the database has no users. It leaves existing rows in place. `npm run db:load-demo -- --replace` reloads the snapshot.

`prisma/dev.db` is the sample snapshot, not the database this server reads. `npm run test:sqlite` is the SQLite before-test path and uses a disposable file.

## Dev server

If something is already listening on port 3000, leave it running and report `http://localhost:3000`. Do not start a second server.

Otherwise start the dev server in the background so it can bind to the port and reach CoinGecko:

```bash
npm run dev
```

Wait until the log shows `Ready` and `Local: http://localhost:3000`.

## Ready

The demo is up when both are true:

- `curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3000` prints `200`
- The response body contains `Welcome to TradeSim`

Report the commit `main` is on, whether `migrate deploy` applied cleanly, and the URL `http://localhost:3000`.
