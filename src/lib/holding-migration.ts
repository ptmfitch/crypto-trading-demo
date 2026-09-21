import { randomBytes } from "node:crypto";

import { ASSET_IDS, type AssetId } from "./assets.ts";

export type LegacyWallet = {
  userId: string;
  usdtBalance: string | number;
  btcBalance: string | number;
};

export type SeedHolding = {
  userId: string;
  assetId: AssetId;
  amount: string;
};

export function seedHoldings(userId: string): SeedHolding[] {
  return ASSET_IDS.map((assetId) => ({
    userId,
    assetId,
    amount: "0",
  }));
}

function amountString(value: string | number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid amount");
    return String(value);
  }
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) throw new Error("Invalid amount");
  return trimmed;
}

/**
 * Move a legacy wallet onto holdings.
 * USDT stays on the wallet. The old BTC balance becomes the bitcoin holding.
 * Ethereum and Solana are seeded at zero. There is no USDT holding.
 */
export function migrateLegacyWallet(wallet: LegacyWallet): {
  usdtBalance: string;
  holdings: SeedHolding[];
} {
  const userId = wallet.userId;
  const btc = amountString(wallet.btcBalance);
  return {
    usdtBalance: amountString(wallet.usdtBalance),
    holdings: ASSET_IDS.map((assetId) => ({
      userId,
      assetId,
      amount: assetId === "bitcoin" ? btc : "0",
    })),
  };
}

export type LegacyTrade = {
  type: string;
  btcAmount: string | number;
  usdtAmount: string | number;
  priceAtTrade: string | number;
};

export function migrateLegacyTrade(trade: LegacyTrade): {
  side: "BUY" | "SELL";
  assetId: "bitcoin";
  baseAmount: string;
  quoteAmount: string;
  priceAtTrade: string;
} {
  if (trade.type !== "BUY" && trade.type !== "SELL") {
    throw new Error(`Unknown trade side: ${trade.type}`);
  }
  return {
    side: trade.type,
    assetId: "bitcoin",
    baseAmount: amountString(trade.btcAmount),
    quoteAmount: amountString(trade.usdtAmount),
    priceAtTrade: amountString(trade.priceAtTrade),
  };
}

export function walletNeedsHoldingMigration(columnNames: string[]) {
  return columnNames.includes("btcBalance");
}

type SqlStatement = {
  all(...args: unknown[]): unknown[];
  run(...args: unknown[]): unknown;
};

type SqlDb = {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
};

function newId() {
  return randomBytes(16).toString("hex");
}

/**
 * Rebuild Wallet and Trade to the holdings schema, copying balances and fills.
 * No-ops once `Wallet.btcBalance` is gone. Table shapes match `prisma db push`.
 */
export function migrateLegacySqlite(db: SqlDb): { migrated: boolean } {
  const columns = db.prepare(`PRAGMA table_info("Wallet")`).all() as {
    name: string;
  }[];
  if (!walletNeedsHoldingMigration(columns.map((column) => column.name))) {
    return { migrated: false };
  }

  const wallets = db
    .prepare(
      `SELECT "userId", "usdtBalance", "btcBalance" FROM "Wallet"`
    )
    .all() as LegacyWallet[];
  const trades = db
    .prepare(
      `SELECT "id", "userId", "type", "btcAmount", "usdtAmount", "priceAtTrade", "timestamp" FROM "Trade"`
    )
    .all() as (LegacyTrade & {
    id: string;
    userId: string;
    timestamp: string;
  })[];

  const migratedWallets = wallets.map((wallet) => ({
    ...migrateLegacyWallet(wallet),
    userId: wallet.userId,
  }));
  const migratedTrades = trades.map((trade) => ({
    ...trade,
    ...migrateLegacyTrade(trade),
  }));

  db.exec("PRAGMA defer_foreign_keys=ON");
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE "Holding" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "assetId" TEXT NOT NULL,
          "amount" DECIMAL NOT NULL DEFAULT 0,
          CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    const insertHolding = db.prepare(
      `INSERT INTO "Holding" ("id", "userId", "assetId", "amount") VALUES (?, ?, ?, ?)`
    );
    for (const wallet of migratedWallets) {
      for (const holding of wallet.holdings) {
        insertHolding.run(newId(), holding.userId, holding.assetId, holding.amount);
      }
    }
    db.exec(`
      CREATE UNIQUE INDEX "Holding_userId_assetId_key" ON "Holding"("userId", "assetId")
    `);

    db.exec(`
      CREATE TABLE "new_Trade" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "side" TEXT NOT NULL,
          "assetId" TEXT NOT NULL,
          "baseAmount" DECIMAL NOT NULL,
          "quoteAmount" DECIMAL NOT NULL,
          "priceAtTrade" DECIMAL NOT NULL,
          "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    const insertTrade = db.prepare(
      `INSERT INTO "new_Trade" ("id", "userId", "side", "assetId", "baseAmount", "quoteAmount", "priceAtTrade", "timestamp") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const trade of migratedTrades) {
      insertTrade.run(
        trade.id,
        trade.userId,
        trade.side,
        trade.assetId,
        trade.baseAmount,
        trade.quoteAmount,
        trade.priceAtTrade,
        trade.timestamp
      );
    }
    db.exec(`DROP TABLE "Trade"`);
    db.exec(`ALTER TABLE "new_Trade" RENAME TO "Trade"`);

    db.exec(`
      CREATE TABLE "new_Wallet" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "usdtBalance" DECIMAL NOT NULL DEFAULT 10000.00,
          CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    const walletIds = db
      .prepare(`SELECT "id", "userId" FROM "Wallet"`)
      .all() as { id: string; userId: string }[];
    const usdtByUser = new Map(
      migratedWallets.map((wallet) => [wallet.userId, wallet.usdtBalance])
    );
    const insertWallet = db.prepare(
      `INSERT INTO "new_Wallet" ("id", "userId", "usdtBalance") VALUES (?, ?, ?)`
    );
    for (const wallet of walletIds) {
      insertWallet.run(wallet.id, wallet.userId, usdtByUser.get(wallet.userId));
    }
    db.exec(`DROP TABLE "Wallet"`);
    db.exec(`ALTER TABLE "new_Wallet" RENAME TO "Wallet"`);
    db.exec(
      `CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId")`
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys=ON");
    db.exec("PRAGMA defer_foreign_keys=OFF");
  }

  return { migrated: true };
}
