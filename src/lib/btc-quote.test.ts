import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTradableQuote,
  FRESH_TTL_MS,
  quoteDelayLabel,
  resolveBtcQuote,
  TRADE_PAUSED_ERROR,
  usdToGbpAmount,
} from "./btc-quote.ts";

const NOW = 1_700_000_000_000;

describe("resolveBtcQuote", () => {
  it("keeps a recent cache fresh without calling upstream", () => {
    const quote = resolveBtcQuote({
      now: NOW,
      cached: { usd: 64000, gbp: null, usd24hChange: 1.2, fetchedAt: NOW - 10_000 },
      upstream: null,
    });
    assert.equal(quote.status, "fresh");
    assert.equal(quote.usd, 64000);
    assert.equal(quote.nextCache, null);
  });

  it("stores a successful upstream quote as fresh", () => {
    const quote = resolveBtcQuote({
      now: NOW,
      cached: { usd: 100, gbp: null, usd24hChange: null, fetchedAt: NOW - FRESH_TTL_MS },
      upstream: { ok: true, usd: 65000.5, gbp: 51200.4, usd24hChange: -0.4 },
    });
    assert.equal(quote.status, "fresh");
    assert.equal(quote.usd, 65000.5);
    assert.equal(quote.gbp, 51200.4);
    assert.deepEqual(quote.nextCache, {
      usd: 65000.5,
      gbp: 51200.4,
      usd24hChange: -0.4,
      fetchedAt: NOW,
    });
  });

  it("keeps USD valid when GBP is missing from upstream", () => {
    const quote = resolveBtcQuote({
      now: NOW,
      cached: null,
      upstream: { ok: true, usd: 65000, gbp: null, usd24hChange: null },
    });
    assert.equal(quote.status, "fresh");
    assert.equal(quote.usd, 65000);
    assert.equal(quote.gbp, null);
  });

  it("ignores invalid GBP from cache", () => {
    const quote = resolveBtcQuote({
      now: NOW,
      cached: { usd: 64000, gbp: 0, usd24hChange: null, fetchedAt: NOW - 10_000 },
      upstream: null,
    });
    assert.equal(quote.usd, 64000);
    assert.equal(quote.gbp, null);
  });

  it("returns the last good price as stale when upstream fails", () => {
    const quote = resolveBtcQuote({
      now: NOW,
      cached: { usd: 64000, gbp: 50000, usd24hChange: 1, fetchedAt: NOW - FRESH_TTL_MS },
      upstream: { ok: false },
    });
    assert.equal(quote.status, "stale");
    assert.equal(quote.usd, 64000);
    assert.equal(quoteDelayLabel(quote.status), "Price delayed");
    assert.equal(quote.nextCache, null);
  });

  it("marks a failed refresh stale even when the cache is still inside the TTL", () => {
    const quote = resolveBtcQuote({
      now: NOW,
      cached: { usd: 64000, gbp: null, usd24hChange: null, fetchedAt: NOW - 5_000 },
      upstream: { ok: false },
    });
    assert.equal(quote.status, "stale");
    assert.equal(quote.usd, 64000);
  });

  it("is unavailable when the feed fails and nothing was cached", () => {
    const quote = resolveBtcQuote({
      now: NOW,
      cached: null,
      upstream: { ok: false },
    });
    assert.equal(quote.status, "unavailable");
    assert.equal(quote.usd, null);
    assert.equal(quoteDelayLabel(quote.status), "Price unavailable");
  });

  it("ignores a corrupt cache", () => {
    const quote = resolveBtcQuote({
      now: NOW,
      cached: { usd: 0, gbp: null, usd24hChange: null, fetchedAt: NOW },
      upstream: { ok: false },
    });
    assert.equal(quote.status, "unavailable");
  });
});

describe("usdToGbpAmount", () => {
  it("converts USD totals using the implied BTC rate", () => {
    const converted = usdToGbpAmount(10000, { usd: 64000, gbp: 50000 });
    assert.ok(converted != null);
    assert.ok(Math.abs(converted - 7812.5) < 0.01);
  });

  it("returns null when GBP is unavailable", () => {
    assert.equal(usdToGbpAmount(10000, { usd: 64000, gbp: null }), null);
    assert.equal(usdToGbpAmount(null, { usd: 64000, gbp: 50000 }), null);
  });
});

describe("assertTradableQuote", () => {
  it("allows a fresh positive price", () => {
    assert.deepEqual(assertTradableQuote({ status: "fresh", usd: 64000 }), {
      ok: true,
      usd: 64000,
    });
  });

  it("pauses stale, missing, and empty quotes", () => {
    for (const quote of [
      { status: "stale" as const, usd: 64000 },
      { status: "unavailable" as const, usd: null },
      { status: "fresh" as const, usd: null },
    ]) {
      assert.deepEqual(assertTradableQuote(quote), {
        ok: false,
        error: TRADE_PAUSED_ERROR,
      });
    }
  });
});
