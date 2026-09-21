import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ASSET_IDS,
  ASSETS,
  assetIdSchema,
  assetMatchesQuery,
  QUOTE_SYMBOL,
} from "./assets.ts";
import { seedHoldings } from "./holding-migration.ts";

describe("asset allowlist", () => {
  it("is keyed by CoinGecko ids and keeps USDT as the only quote", () => {
    assert.deepEqual(ASSET_IDS, ["bitcoin", "ethereum", "solana"]);
    assert.equal(ASSETS.bitcoin.symbol, "BTC");
    assert.equal(ASSETS.bitcoin.name, "Bitcoin");
    assert.equal(ASSETS.ethereum.symbol, "ETH");
    assert.equal(ASSETS.solana.symbol, "SOL");
    assert.equal(QUOTE_SYMBOL, "USDT");
    assert.equal(assetIdSchema.safeParse("bitcoin").success, true);
    assert.equal(assetIdSchema.safeParse("ethereum").success, true);
    assert.equal(assetIdSchema.safeParse("solana").success, true);
    assert.equal(assetIdSchema.safeParse("BTC").success, false);
    assert.equal(assetIdSchema.safeParse("USDT").success, false);
    assert.equal(assetIdSchema.safeParse("dogecoin").success, false);
  });

  it("seeds a zero holding for each allowlisted coin and no USDT holding", () => {
    const rows = seedHoldings("user-1");
    assert.deepEqual(
      rows.map((row) => row.assetId),
      ["bitcoin", "ethereum", "solana"]
    );
    assert.ok(rows.every((row) => row.userId === "user-1" && row.amount === "0"));
  });
});

describe("assetMatchesQuery", () => {
  it("matches name and symbol, including a fuzzy subsequence", () => {
    assert.equal(assetMatchesQuery(ASSETS.ethereum, ""), true);
    assert.equal(assetMatchesQuery(ASSETS.ethereum, "eth"), true);
    assert.equal(assetMatchesQuery(ASSETS.ethereum, "Ether"), true);
    assert.equal(assetMatchesQuery(ASSETS.bitcoin, "bt"), true);
    assert.equal(assetMatchesQuery(ASSETS.solana, "sln"), true);
    assert.equal(assetMatchesQuery(ASSETS.bitcoin, "sol"), false);
    assert.equal(assetMatchesQuery(ASSETS.ethereum, "zzz"), false);
  });
});
