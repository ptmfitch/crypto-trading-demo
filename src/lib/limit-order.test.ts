import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "@prisma/client";

import { ASSET_IDS, ASSET_SYMBOL, formatFillToast } from "./assets.ts";
import {
  LEDGER_ASSETS,
  LEDGER_SYMBOL,
  buildLimitOrder,
  cancelPending,
  creditFill,
  emptyPosition,
  fillTrade,
  reserveOnPlace,
  type Position,
} from "./limit-order.ts";

function d(value: string | number) {
  return new Prisma.Decimal(value);
}

function cash(usdt: string, extras?: Partial<Record<"bitcoin" | "ethereum" | "solana", string>>): Position {
  return {
    usdt: d(usdt),
    bitcoin: d(extras?.bitcoin ?? 0),
    ethereum: d(extras?.ethereum ?? 0),
    solana: d(extras?.solana ?? 0),
  };
}

describe("limit order allowlist", () => {
  it("keeps the client asset list aligned with the ledger", () => {
    assert.deepEqual(ASSET_IDS, LEDGER_ASSETS);
    assert.deepEqual(ASSET_SYMBOL, LEDGER_SYMBOL);
  });
});

describe("limit buy reserve, fill, and cancel", () => {
  const order = buildLimitOrder({
    side: "BUY",
    assetId: "ethereum",
    limitPrice: d("3200"),
    amount: d("500"),
  });

  it("reserves the typed USDT and sizes the base at the limit", () => {
    assert.equal(order.status, "PENDING");
    assert.equal(order.baseAmount.toString(), "0.15625");
    assert.ok(order.quoteReserved.eq(d(500)));

    const reserved = reserveOnPlace(cash("10000"), order);
    assert.ok(reserved.usdt.eq(d(9500)));
    assert.ok(reserved.ethereum.eq(0));
    assert.throws(
      () => reserveOnPlace(reserved, buildLimitOrder({
        side: "BUY",
        assetId: "ethereum",
        limitPrice: d("3200"),
        amount: d("9600"),
      })),
      /Insufficient USDT balance/
    );
  });

  it("fills 100% at the limit when live is at or below it, without spending USDT again", () => {
    const reserved = reserveOnPlace(cash("10000"), order);
    const below = fillTrade(order, d("3000"));
    const at = fillTrade(order, d("3200"));
    assert.equal(fillTrade(order, d("3200.01")), null);
    assert.ok(below);
    assert.ok(at);
    assert.ok(below.priceAtTrade.eq(order.limitPrice));
    assert.ok(below.quoteAmount.eq(order.quoteReserved));
    assert.ok(below.baseAmount.eq(order.baseAmount));
    assert.notEqual(below.priceAtTrade.toString(), "3000");

    const filled = creditFill(reserved, order);
    assert.ok(filled.usdt.eq(reserved.usdt));
    assert.ok(filled.ethereum.eq(order.baseAmount));
    assert.equal(
      formatFillToast(
        "BUY",
        "ethereum",
        Number(order.baseAmount.toString()),
        Number(order.limitPrice.toString())
      ),
      "Limit buy filled · 0.15625 ETH at $3,200"
    );
  });

  it("returns the USDT reserve on cancel and refuses a second cancel or fill", () => {
    const reserved = reserveOnPlace(cash("10000"), order);
    const canceled = cancelPending(reserved, order);
    assert.equal(canceled.order.status, "CANCELED");
    assert.ok(canceled.position.usdt.eq(d(10000)));
    assert.ok(canceled.position.ethereum.eq(0));
    assert.throws(() => cancelPending(canceled.position, canceled.order), /not pending/);
    assert.equal(fillTrade(canceled.order, d("1")), null);
    assert.throws(() => creditFill(canceled.position, canceled.order), /not pending/);
  });
});

describe("limit sell reserve, fill, and cancel", () => {
  const order = buildLimitOrder({
    side: "SELL",
    assetId: "solana",
    limitPrice: d("150"),
    amount: d("2"),
  });

  it("locks the base asset and credits USDT at the limit, not the higher print", () => {
    const reserved = reserveOnPlace(cash("1000", { solana: "2" }), order);
    assert.ok(reserved.solana.eq(0));
    assert.ok(reserved.usdt.eq(d(1000)));
    assert.ok(order.quoteReserved.eq(d(300)));

    assert.equal(fillTrade(order, d("149.99")), null);
    const trade = fillTrade(order, d("180"));
    assert.ok(trade);
    assert.ok(trade.priceAtTrade.eq(d(150)));
    assert.ok(trade.quoteAmount.eq(d(300)));

    const filled = creditFill(reserved, order);
    assert.ok(filled.solana.eq(reserved.solana));
    assert.ok(filled.usdt.eq(d(1300)));
  });

  it("returns the base asset on cancel", () => {
    const reserved = reserveOnPlace(cash("1000", { solana: "2" }), order);
    const canceled = cancelPending(reserved, order);
    assert.ok(canceled.position.solana.eq(d(2)));
    assert.ok(canceled.position.usdt.eq(d(1000)));
    assert.equal(canceled.order.status, "CANCELED");
  });

  it("does not reserve from an empty position", () => {
    assert.throws(
      () => reserveOnPlace(emptyPosition(), order),
      /Insufficient SOL balance/
    );
  });
});
