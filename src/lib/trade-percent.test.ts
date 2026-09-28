import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { percentPayAmount } from "./trade-percent.ts";

const USDT_BALANCE = 10000;

describe("percentPayAmount", () => {
  it("fills 25% of a known USDT balance", () => {
    assert.equal(percentPayAmount(USDT_BALANCE, 25, "USDT"), 2500);
  });

  it("fills 50% of a known USDT balance", () => {
    assert.equal(percentPayAmount(USDT_BALANCE, 50, "USDT"), 5000);
  });

  it("fills 100% of a known USDT balance", () => {
    assert.equal(percentPayAmount(USDT_BALANCE, 100, "USDT"), 10000);
  });

  it("fills 100% of a known BTC balance without rounding away the remainder", () => {
    assert.equal(percentPayAmount(0.123456789, 100, "BTC"), 0.12345679);
  });
});
