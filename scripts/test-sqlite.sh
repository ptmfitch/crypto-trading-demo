#!/usr/bin/env bash
# Behavior tests against a disposable SQLite file. Does not open prisma/dev.db.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

db="${TMPDIR:-/tmp}/crypto-trading-demo-sqlite-behavior.db"
rm -f "$db" "$db-journal"

export DATABASE_URL="file:${db}"
export DATABASE_TEST=1
unset CHECK_MIGRATION_PARITY

npx prisma generate --schema=prisma/schema.sqlite.prisma
npx prisma db push --schema=prisma/schema.sqlite.prisma --skip-generate --accept-data-loss

node --experimental-strip-types --import ./scripts/register-ts.mjs \
  --test --test-concurrency=1 src/lib/database.test.ts
