import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FRESH_TTL_MS } from "./btc-quote.ts";
import {
  allowlistPriceUrl,
  cachedQuotesFromFile,
  marketCacheFile,
  parseAllowlistPrice,
  resolveMarketQuotes,
} from "./market-price.ts";

const NOW = 1_700_000_000_000;

describe("allowlist price request", () => {
  it("asks CoinGecko only for the allowlisted ids", () => {
    const url = new URL(allowlistPriceUrl());
    assert.equal(url.origin, "https://api.coingecko.com");
    assert.equal(url.pathname, "/api/v3/simple/price");
    assert.equal(url.searchParams.get("ids"), "bitcoin,ethereum,solana");
    assert.equal(url.searchParams.get("vs_currencies"), "usd");
    assert.equal(url.pathname.includes("search"), false);
  });

  it("reads allowlisted quotes and ignores other coins", () => {
    const quotes = parseAllowlistPrice({
      bitcoin: { usd: 95000, usd_24h_change: 1.2 },
      ethereum: { usd: 3420, usd_24h_change: -0.4 },
      solana: { usd: 178 },
      dogecoin: { usd: 0.1, usd_24h_change: 5 },
    });
    assert.equal(quotes.bitcoin.ok && quotes.bitcoin.usd, 95000);
    assert.equal(quotes.ethereum.ok && quotes.ethereum.usd24hChange, -0.4);
    assert.equal(quotes.solana.ok && quotes.solana.usd24hChange, null);
    assert.equal("dogecoin" in quotes, false);
  });

  it("marks a missing or invalid coin as a failed quote", () => {
    const quotes = parseAllowlistPrice({
      bitcoin: { usd: 0 },
      ethereum: { usd: "3420" },
    });
    assert.deepEqual(quotes.bitcoin, { ok: false });
    assert.deepEqual(quotes.ethereum, { ok: false });
    assert.deepEqual(quotes.solana, { ok: false });
  });
});

describe("market quote cache", () => {
  it("treats a legacy bitcoin cache file as bitcoin only", () => {
    const cached = cachedQuotesFromFile({
      usd: 64000,
      usd24hChange: 1,
      fetchedAt: NOW,
    });
    assert.equal(cached.bitcoin?.usd, 64000);
    assert.equal(cached.ethereum, undefined);
    assert.equal(cached.solana, undefined);
  });

  it("keeps the top-level usd field as the bitcoin quote", () => {
    const file = marketCacheFile({
      bitcoin: { usd: 95000, usd24hChange: 1.2, fetchedAt: NOW },
      ethereum: { usd: 3420, usd24hChange: -0.4, fetchedAt: NOW },
    });
    assert.equal(file?.usd, 95000);
    assert.equal(file?.quotes.ethereum?.usd, 3420);
    const roundTrip = cachedQuotesFromFile(file);
    assert.equal(roundTrip.ethereum?.usd, 3420);
  });

  it("keeps every cached coin fresh until one upstream refresh is due", () => {
    const quotes = resolveMarketQuotes({
      now: NOW,
      cached: {
        bitcoin: { usd: 1, usd24hChange: null, fetchedAt: NOW - 1_000 },
        ethereum: { usd: 2, usd24hChange: null, fetchedAt: NOW - 1_000 },
        solana: { usd: 3, usd24hChange: null, fetchedAt: NOW - 1_000 },
      },
      upstream: null,
    });
    assert.equal(quotes.bitcoin.status, "fresh");
    assert.equal(quotes.solana.status, "fresh");
    assert.equal(quotes.ethereum.nextCache, null);
  });

  it("marks a failed refresh stale without dropping the last price", () => {
    const quotes = resolveMarketQuotes({
      now: NOW,
      cached: {
        bitcoin: { usd: 64000, usd24hChange: null, fetchedAt: NOW - FRESH_TTL_MS },
        ethereum: { usd: 3000, usd24hChange: null, fetchedAt: NOW - FRESH_TTL_MS },
        solana: { usd: 150, usd24hChange: null, fetchedAt: NOW - FRESH_TTL_MS },
      },
      upstream: {
        bitcoin: { ok: false },
        ethereum: { ok: true, usd: 3420, usd24hChange: -0.4 },
        solana: { ok: false },
      },
    });
    assert.equal(quotes.bitcoin.status, "stale");
    assert.equal(quotes.bitcoin.usd, 64000);
    assert.equal(quotes.ethereum.status, "fresh");
    assert.equal(quotes.ethereum.usd, 3420);
    assert.equal(quotes.solana.status, "stale");
  });
});
