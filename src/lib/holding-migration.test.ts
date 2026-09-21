import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import {
  migrateLegacySqlite,
  migrateLegacyTrade,
  migrateLegacyWallet,
  walletNeedsHoldingMigration,
} from "./holding-migration.ts";

const LEGACY_SCHEMA = `
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL
);
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "usdtBalance" DECIMAL NOT NULL DEFAULT 10000.00,
    "btcBalance" DECIMAL NOT NULL DEFAULT 0.00,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "btcAmount" DECIMAL NOT NULL,
    "usdtAmount" DECIMAL NOT NULL,
    "priceAtTrade" DECIMAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`;

describe("migrateLegacyWallet", () => {
  it("keeps USDT on the wallet and moves BTC onto a bitcoin holding", () => {
    const migrated = migrateLegacyWallet({
      userId: "user-1",
      usdtBalance: "9000.50",
      btcBalance: "0.125",
    });
    assert.equal(migrated.usdtBalance, "9000.50");
    assert.deepEqual(
      migrated.holdings.map((holding) => [holding.assetId, holding.amount]),
      [
        ["bitcoin", "0.125"],
        ["ethereum", "0"],
        ["solana", "0"],
      ]
    );
    assert.equal(
      migrated.holdings.some((holding) => holding.assetId === "bitcoin"),
      true
    );
    assert.equal(
      migrated.holdings.every((holding) => holding.amount !== undefined),
      true
    );
  });
});

describe("migrateLegacyTrade", () => {
  it("maps a BTC fill onto side, assetId, baseAmount, and quoteAmount", () => {
    assert.deepEqual(
      migrateLegacyTrade({
        type: "BUY",
        btcAmount: "0.01",
        usdtAmount: "640.00",
        priceAtTrade: "64000",
      }),
      {
        side: "BUY",
        assetId: "bitcoin",
        baseAmount: "0.01",
        quoteAmount: "640.00",
        priceAtTrade: "64000",
      }
    );
    assert.equal(
      migrateLegacyTrade({
        type: "SELL",
        btcAmount: "0.2",
        usdtAmount: "1000",
        priceAtTrade: "5000",
      }).side,
      "SELL"
    );
  });

  it("rejects a side outside BUY and SELL", () => {
    assert.throws(
      () =>
        migrateLegacyTrade({
          type: "HOLD",
          btcAmount: "1",
          usdtAmount: "1",
          priceAtTrade: "1",
        }),
      /Unknown trade side/
    );
  });
});

describe("migrateLegacySqlite", () => {
  it("copies balances and fills, then no-ops", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(LEGACY_SCHEMA);
    db.prepare(`INSERT INTO "User" ("id", "email") VALUES (?, ?)`).run(
      "user-1",
      "ada@example.com"
    );
    db.prepare(
      `INSERT INTO "Wallet" ("id", "userId", "usdtBalance", "btcBalance") VALUES (?, ?, ?, ?)`
    ).run("wallet-1", "user-1", "9000.50", "0.125");
    db.prepare(
      `INSERT INTO "Trade" ("id", "userId", "type", "btcAmount", "usdtAmount", "priceAtTrade", "timestamp") VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run("trade-1", "user-1", "BUY", "0.01", "640.00", "64000", "2024-01-01 00:00:00");

    assert.equal(migrateLegacySqlite(db).migrated, true);

    const columns = db.prepare(`PRAGMA table_info("Wallet")`).all() as {
      name: string;
    }[];
    assert.equal(
      walletNeedsHoldingMigration(columns.map((column) => column.name)),
      false
    );
    const wallet = db
      .prepare(`SELECT "usdtBalance" FROM "Wallet" WHERE "userId" = ?`)
      .get("user-1") as { usdtBalance: string | number };
    assert.equal(String(wallet.usdtBalance), "9000.5");
    const holdings = db
      .prepare(
        `SELECT "assetId", "amount" FROM "Holding" WHERE "userId" = ? ORDER BY "assetId"`
      )
      .all("user-1") as { assetId: string; amount: string | number }[];
    assert.deepEqual(
      holdings.map((holding) => [holding.assetId, String(holding.amount)]),
      [
        ["bitcoin", "0.125"],
        ["ethereum", "0"],
        ["solana", "0"],
      ]
    );
    const trade = db
      .prepare(
        `SELECT "side", "assetId", "baseAmount", "quoteAmount", "priceAtTrade" FROM "Trade" WHERE "id" = ?`
      )
      .get("trade-1") as {
      side: string;
      assetId: string;
      baseAmount: string | number;
      quoteAmount: string | number;
      priceAtTrade: string | number;
    };
    assert.equal(trade.side, "BUY");
    assert.equal(trade.assetId, "bitcoin");
    assert.equal(String(trade.baseAmount), "0.01");
    assert.equal(String(trade.quoteAmount), "640");
    assert.equal(String(trade.priceAtTrade), "64000");
    assert.equal(migrateLegacySqlite(db).migrated, false);
    db.close();
  });
});
