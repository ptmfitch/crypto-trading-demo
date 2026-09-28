#!/usr/bin/env bash
# Same behavior tests against local Postgres, after loading prisma/dev.db.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

export DATABASE_URL="postgresql://$(whoami)@127.0.0.1:5432/crypto_trading_demo_test"
export DATABASE_TEST=1
export CHECK_MIGRATION_PARITY=1
export SQLITE_SOURCE_URL="file:${root}/prisma/dev.db"

npx prisma generate
npx prisma generate --schema=prisma/schema.sqlite.prisma

dropdb --if-exists crypto_trading_demo_test
createdb crypto_trading_demo_test
npx prisma migrate deploy

node --experimental-strip-types --import ./scripts/register-ts.mjs \
  --test --test-concurrency=1 src/lib/database.test.ts
