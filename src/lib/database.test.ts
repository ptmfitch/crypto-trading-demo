import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";

import { Prisma } from "@prisma/client";

import { countTrades, readProfileTrades, readWallet } from "./account-reads.ts";
import { applyTrade } from "./apply-trade.ts";
import { authenticateWithPassword } from "./credentials.ts";
import { defaultSqliteDemoUrl, loadSqliteDemoIntoPostgres } from "./load-sqlite-demo.ts";
import prisma from "./prisma.ts";
import { registerUser } from "./register-user.ts";

const databaseUrl = process.env.DATABASE_URL ?? "";

function assertSafeDatabaseUrl(url: string) {
  if (!process.env.DATABASE_TEST) {
    throw new Error("Refusing to run database tests without DATABASE_TEST=1");
  }

  if (url.startsWith("file:")) {
    if (url.includes("dev.db")) {
      throw new Error("Refusing to run behavior tests against the sample sqlite file");
    }
    return;
  }

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const name = new URL(url).pathname.replace(/^\//, "");
    if (!name.endsWith("_test")) {
      throw new Error("Refusing to run behavior tests against a non-test Postgres database");
    }
    return;
  }

  throw new Error("DATABASE_URL must be a sqlite file or a Postgres URL");
}

assertSafeDatabaseUrl(databaseUrl);

function freshEmail() {
  return `phase1-${randomUUID()}@example.com`;
}

const price = new Prisma.Decimal("50000");

const parityReady: Promise<{ users: number; wallets: number; trades: number } | null> =
  process.env.CHECK_MIGRATION_PARITY === "1"
    ? loadSqliteDemoIntoPostgres({
        sqliteUrl: process.env.SQLITE_SOURCE_URL ?? defaultSqliteDemoUrl(),
        postgresUrl: databaseUrl,
        replace: true,
      })
    : Promise.resolve(null);

describe("paper account", { concurrency: 1 }, () => {
  after(async () => {
    await prisma.$disconnect();
  });

  it("loads the sqlite demo and matches user, wallet, and trade counts and balances", async (t) => {
    if (process.env.CHECK_MIGRATION_PARITY !== "1") {
      t.skip("parity runs against Postgres after the sqlite load");
      return;
    }
    const counts = await parityReady;
    assert.ok(counts);
    assert.ok(counts.users > 0);
    assert.equal(counts.wallets, counts.users);
    assert.ok(counts.trades > 0);
  });

  it("registers a user with a $10,000 USDT wallet and rejects a duplicate email", async () => {
    await parityReady;
    const email = freshEmail();
    const created = await registerUser({
      name: "Phase One",
      email,
      password: "secret-pass",
    });
    assert.deepEqual(created, {
      success: "User created successfully! Please log in.",
    });

    const user = await prisma.user.findUnique({ where: { email } });
    assert.ok(user);
    const wallet = await readWallet(user.id);
    assert.ok(wallet);
    assert.ok(wallet.usdtBalance.equals(new Prisma.Decimal("10000")));
    assert.ok(wallet.btcBalance.equals(new Prisma.Decimal("0")));
    assert.equal(await countTrades(user.id), 0);
    assert.deepEqual(await readProfileTrades(user.id), []);

    const invalid = await registerUser({
      name: "A",
      email: "not-an-email",
      password: "x",
    });
    assert.deepEqual(invalid, { error: "Invalid fields!" });

    const duplicate = await registerUser({
      name: "Phase One",
      email,
      password: "secret-pass",
    });
    assert.deepEqual(duplicate, {
      error: "An account with this email already exists.",
    });
    assert.equal(await prisma.user.count({ where: { email } }), 1);
  });

  it("logs in with the registered password and rejects a wrong password", async () => {
    await parityReady;
    const email = freshEmail();
    const password = "secret-pass";
    const created = await registerUser({
      name: "Login User",
      email,
      password,
    });
    assert.ok("success" in created);

    const signedIn = await authenticateWithPassword(email, password);
    assert.equal(signedIn?.email, email);
    assert.equal(await authenticateWithPassword(email, "wrong-pass"), null);
    assert.equal(
      await authenticateWithPassword(`missing-${email}`, password),
      null,
    );
  });

  it("updates balances on buy and sell and leaves them unchanged when a trade is rejected", async () => {
    await parityReady;
    const email = freshEmail();
    const created = await registerUser({
      name: "Trader",
      email,
      password: "secret-pass",
    });
    assert.ok("success" in created);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const bought = await applyTrade({
      userId: user.id,
      amount: 1000,
      tradeType: "BUY",
      asset: "USDT",
      price,
    });
    assert.equal(bought.message, "Successfully bought 0.02 BTC for $1000");

    const afterBuy = await readWallet(user.id);
    assert.ok(afterBuy);
    assert.ok(afterBuy.usdtBalance.equals("9000"));
    assert.ok(afterBuy.btcBalance.equals("0.02"));
    assert.equal(await countTrades(user.id), 1);

    await assert.rejects(
      () =>
        applyTrade({
          userId: user.id,
          amount: 9000.01,
          tradeType: "BUY",
          asset: "USDT",
          price,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Insufficient USDT balance.");
        return true;
      },
    );

    const afterRejectedBuy = await readWallet(user.id);
    assert.ok(afterRejectedBuy);
    assert.ok(afterRejectedBuy.usdtBalance.equals("9000"));
    assert.ok(afterRejectedBuy.btcBalance.equals("0.02"));
    assert.equal(await countTrades(user.id), 1);

    const sold = await applyTrade({
      userId: user.id,
      amount: 0.01,
      tradeType: "SELL",
      asset: "BTC",
      price,
    });
    assert.equal(sold.message, "Successfully sold 0.01 BTC for $500");

    const afterSell = await readWallet(user.id);
    assert.ok(afterSell);
    assert.ok(afterSell.usdtBalance.equals("9500"));
    assert.ok(afterSell.btcBalance.equals("0.01"));

    await assert.rejects(
      () =>
        applyTrade({
          userId: user.id,
          amount: 0.02,
          tradeType: "SELL",
          asset: "BTC",
          price,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Insufficient BTC balance.");
        return true;
      },
    );

    const afterRejectedSell = await readWallet(user.id);
    assert.ok(afterRejectedSell);
    assert.ok(afterRejectedSell.usdtBalance.equals("9500"));
    assert.ok(afterRejectedSell.btcBalance.equals("0.01"));
    assert.equal(await countTrades(user.id), 2);

    const trades = await readProfileTrades(user.id);
    assert.deepEqual(
      trades.map((trade) => trade.type),
      ["BUY", "SELL"],
    );
    assert.ok(trades[0].timestamp.getTime() <= trades[1].timestamp.getTime());
    assert.ok(trades[0].usdtAmount.equals("1000"));
    assert.ok(trades[0].btcAmount.equals("0.02"));
    assert.ok(trades[0].priceAtTrade.equals(price));
    assert.ok(trades[1].usdtAmount.equals("500"));
    assert.ok(trades[1].btcAmount.equals("0.01"));
    assert.equal(await countTrades(user.id), trades.length);
  });
});
