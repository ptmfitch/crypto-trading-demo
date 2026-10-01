import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateAdvancedStats,
  formatWinRate,
} from "./key-metrics.ts";

function risingPnl(count: number) {
  return Array.from({ length: count }, (_, index) => ({ pnl: index + 1 }));
}

describe("key metrics win rate", () => {
  it("is N/A when there are no trades", () => {
    const stats = calculateAdvancedStats(0, []);
    assert.equal(stats.winRate, null);
    assert.equal(formatWinRate(stats.winRate), "N/A");
    assert.equal(stats.bestTradePnl, 0);
    assert.equal(stats.worstTradePnl, 0);
  });

  it("stays 0% for a single trade", () => {
    const stats = calculateAdvancedStats(1, [{ pnl: 25 }]);
    assert.equal(stats.winRate, 0);
    assert.equal(formatWinRate(stats.winRate), "0.0%");
  });

  it("reports wins over trades on a 0–100 scale", () => {
    const stats = calculateAdvancedStats(2, [{ pnl: 0 }, { pnl: 40 }]);
    assert.equal(stats.winRate, 50);
    assert.equal(formatWinRate(stats.winRate), "50.0%");
    assert.equal(stats.bestTradePnl, 40);
    assert.equal(stats.worstTradePnl, 0);
  });

  it("does not cap a perfect record at 10%", () => {
    const stats = calculateAdvancedStats(10, risingPnl(10));
    assert.equal(stats.winRate, 100);
    assert.equal(formatWinRate(stats.winRate), "100.0%");
  });

  it("formats a one-in-four record as 25.0%, not 2.5%", () => {
    const stats = calculateAdvancedStats(4, [
      { pnl: 0 },
      { pnl: 10 },
      { pnl: 10 },
      { pnl: 4 },
    ]);
    assert.equal(stats.winRate, 25);
    assert.equal(formatWinRate(stats.winRate), "25.0%");
    assert.equal(stats.bestTradePnl, 10);
    assert.equal(stats.worstTradePnl, -6);
  });
});
