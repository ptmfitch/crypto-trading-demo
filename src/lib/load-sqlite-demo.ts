import { PrismaClient } from "@prisma/client";
import { PrismaClient as SqlitePrismaClient } from "../generated/sqlite/index.js";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const allowedDatabases = new Set([
  "crypto_trading_demo",
  "crypto_trading_demo_test",
]);

export function defaultSqliteDemoUrl() {
  return `file:${path.join(repoRoot, "prisma", "dev.db")}`;
}

function databaseName(postgresUrl: string) {
  if (!postgresUrl.startsWith("postgres://") && !postgresUrl.startsWith("postgresql://")) {
    throw new Error("Demo load target must be a postgres URL");
  }
  return new URL(postgresUrl).pathname.replace(/^\//, "");
}

function assertAllowedTarget(postgresUrl: string) {
  const name = databaseName(postgresUrl);
  if (!allowedDatabases.has(name)) {
    throw new Error(
      `Refusing to load demo data into database "${name}". Expected crypto_trading_demo or crypto_trading_demo_test.`,
    );
  }
  return name;
}

type DemoCounts = {
  users: number;
  wallets: number;
  trades: number;
  accounts: number;
  sessions: number;
};

export async function loadSqliteDemoIntoPostgres(options?: {
  sqliteUrl?: string;
  postgresUrl?: string;
  replace?: boolean;
}): Promise<DemoCounts> {
  const sqliteUrl = options?.sqliteUrl ?? process.env.SQLITE_SOURCE_URL ?? defaultSqliteDemoUrl();
  const postgresUrl = options?.postgresUrl ?? process.env.DATABASE_URL ?? "";
  const replace = options?.replace ?? false;
  if (!sqliteUrl.startsWith("file:")) {
    throw new Error("SQLite source must be a file URL");
  }
  const targetName = assertAllowedTarget(postgresUrl);

  const source = new SqlitePrismaClient({ datasourceUrl: sqliteUrl });
  const target = new PrismaClient({ datasourceUrl: postgresUrl });

  try {
    if (!replace) {
      const existing = await target.user.count();
      if (existing > 0) {
        console.log(
          `Postgres database ${targetName} already has ${existing} users; leaving rows in place.`,
        );
        return {
          users: existing,
          wallets: await target.wallet.count(),
          trades: await target.trade.count(),
          accounts: await target.account.count(),
          sessions: await target.session.count(),
        };
      }
    }

    const [users, wallets, trades, accounts, sessions] = await Promise.all([
      source.user.findMany(),
      source.wallet.findMany(),
      source.trade.findMany(),
      source.account.findMany(),
      source.session.findMany(),
    ]);

    await target.$transaction(async (tx) => {
      await tx.trade.deleteMany();
      await tx.wallet.deleteMany();
      await tx.session.deleteMany();
      await tx.account.deleteMany();
      await tx.user.deleteMany();

      if (users.length > 0) {
        await tx.user.createMany({
          data: users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            hashedPassword: user.hashedPassword,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          })),
        });
      }
      if (wallets.length > 0) {
        await tx.wallet.createMany({
          data: wallets.map((wallet) => ({
            id: wallet.id,
            userId: wallet.userId,
            usdtBalance: wallet.usdtBalance.toString(),
            btcBalance: wallet.btcBalance.toString(),
          })),
        });
      }
      if (trades.length > 0) {
        await tx.trade.createMany({
          data: trades.map((trade) => ({
            id: trade.id,
            userId: trade.userId,
            type: trade.type,
            btcAmount: trade.btcAmount.toString(),
            usdtAmount: trade.usdtAmount.toString(),
            priceAtTrade: trade.priceAtTrade.toString(),
            timestamp: trade.timestamp,
          })),
        });
      }
      if (accounts.length > 0) {
        await tx.account.createMany({
          data: accounts.map((account) => ({
            id: account.id,
            userId: account.userId,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          })),
        });
      }
      if (sessions.length > 0) {
        await tx.session.createMany({
          data: sessions.map((session) => ({
            id: session.id,
            sessionToken: session.sessionToken,
            userId: session.userId,
            expires: session.expires,
          })),
        });
      }
    });

    await assertLoadedDemoMatchesSource(source, target);
    const counts = {
      users: users.length,
      wallets: wallets.length,
      trades: trades.length,
      accounts: accounts.length,
      sessions: sessions.length,
    };
    console.log(
      `Loaded demo data into ${targetName}: users=${counts.users} wallets=${counts.wallets} trades=${counts.trades}`,
    );
    return counts;
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

async function assertLoadedDemoMatchesSource(
  source: SqlitePrismaClient,
  target: PrismaClient,
) {
  const [sqliteUsers, postgresUsers, sqliteWallets, postgresWallets, sqliteTrades, postgresTrades, sqliteAccounts, postgresAccounts, sqliteSessions, postgresSessions] =
    await Promise.all([
      source.user.findMany(),
      target.user.findMany(),
      source.wallet.findMany(),
      target.wallet.findMany(),
      source.trade.findMany(),
      target.trade.findMany(),
      source.account.count(),
      target.account.count(),
      source.session.count(),
      target.session.count(),
    ]);

  if (sqliteUsers.length !== postgresUsers.length) {
    throw new Error(
      `User count mismatch: sqlite=${sqliteUsers.length} postgres=${postgresUsers.length}`,
    );
  }
  if (sqliteWallets.length !== postgresWallets.length) {
    throw new Error(
      `Wallet count mismatch: sqlite=${sqliteWallets.length} postgres=${postgresWallets.length}`,
    );
  }
  if (sqliteTrades.length !== postgresTrades.length) {
    throw new Error(
      `Trade count mismatch: sqlite=${sqliteTrades.length} postgres=${postgresTrades.length}`,
    );
  }
  if (sqliteAccounts !== postgresAccounts) {
    throw new Error(
      `Account count mismatch: sqlite=${sqliteAccounts} postgres=${postgresAccounts}`,
    );
  }
  if (sqliteSessions !== postgresSessions) {
    throw new Error(
      `Session count mismatch: sqlite=${sqliteSessions} postgres=${postgresSessions}`,
    );
  }

  const postgresUsersById = new Map(postgresUsers.map((user) => [user.id, user]));
  for (const user of sqliteUsers) {
    const loaded = postgresUsersById.get(user.id);
    if (!loaded) throw new Error(`Missing user ${user.id}`);
    if (loaded.email !== user.email) {
      throw new Error(`Email mismatch for user ${user.id}`);
    }
    if (loaded.name !== user.name) {
      throw new Error(`Name mismatch for user ${user.id}`);
    }
    if (loaded.hashedPassword !== user.hashedPassword) {
      throw new Error(`Password hash mismatch for user ${user.id}`);
    }
    if (loaded.createdAt.getTime() !== user.createdAt.getTime()) {
      throw new Error(`createdAt mismatch for user ${user.id}`);
    }
    if (loaded.updatedAt.getTime() !== user.updatedAt.getTime()) {
      throw new Error(`updatedAt mismatch for user ${user.id}`);
    }
  }

  const postgresWalletsById = new Map(postgresWallets.map((wallet) => [wallet.id, wallet]));
  for (const wallet of sqliteWallets) {
    const loaded = postgresWalletsById.get(wallet.id);
    if (!loaded) throw new Error(`Missing wallet ${wallet.id}`);
    if (loaded.userId !== wallet.userId) {
      throw new Error(`Wallet user mismatch for ${wallet.id}`);
    }
    if (!loaded.usdtBalance.equals(wallet.usdtBalance.toString())) {
      throw new Error(
        `USDT balance mismatch for wallet ${wallet.id}: sqlite=${wallet.usdtBalance.toString()} postgres=${loaded.usdtBalance.toString()}`,
      );
    }
    if (!loaded.btcBalance.equals(wallet.btcBalance.toString())) {
      throw new Error(
        `BTC balance mismatch for wallet ${wallet.id}: sqlite=${wallet.btcBalance.toString()} postgres=${loaded.btcBalance.toString()}`,
      );
    }
  }

  const postgresTradesById = new Map(postgresTrades.map((trade) => [trade.id, trade]));
  for (const trade of sqliteTrades) {
    const loaded = postgresTradesById.get(trade.id);
    if (!loaded) throw new Error(`Missing trade ${trade.id}`);
    if (loaded.userId !== trade.userId || loaded.type !== trade.type) {
      throw new Error(`Trade identity mismatch for ${trade.id}`);
    }
    if (!loaded.btcAmount.equals(trade.btcAmount.toString())) {
      throw new Error(`btcAmount mismatch for trade ${trade.id}`);
    }
    if (!loaded.usdtAmount.equals(trade.usdtAmount.toString())) {
      throw new Error(`usdtAmount mismatch for trade ${trade.id}`);
    }
    if (!loaded.priceAtTrade.equals(trade.priceAtTrade.toString())) {
      throw new Error(`priceAtTrade mismatch for trade ${trade.id}`);
    }
    if (loaded.timestamp.getTime() !== trade.timestamp.getTime()) {
      throw new Error(`timestamp mismatch for trade ${trade.id}`);
    }
  }
}

async function main() {
  const replace = process.argv.includes("--replace");
  await loadSqliteDemoIntoPostgres({ replace });
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Demo load failed";
    console.error(message);
    process.exitCode = 1;
  });
}
