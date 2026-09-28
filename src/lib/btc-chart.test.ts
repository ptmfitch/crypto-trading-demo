import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bitcoinChartName,
  btcChartRangeLabel,
  chartRangeName,
  formatBtcAxisTick,
  formatChartDate,
  formatChartPrice,
} from "./btc-chart.ts";

describe("bitcoin chart axis", () => {
  it("labels a live quote in thousands of dollars, not ten times higher", () => {
    const quote = 82_883;
    const label = formatBtcAxisTick(quote);

    assert.equal(label, "$82.9k");
    assert.notEqual(label, "$828.8k");

    const shown = Number(label.replace(/[$k]/g, "")) * 1000;
    assert.ok(Math.abs(shown - quote) < 100);
  });

  it("keeps round thousands exact", () => {
    assert.equal(formatBtcAxisTick(60_000), "$60.0k");
    assert.equal(formatBtcAxisTick(100_000), "$100.0k");
  });
});

describe("bitcoin chart name and range", () => {
  it("names the default range Bitcoin price, last 30 days", () => {
    const label = btcChartRangeLabel("30");
    assert.equal(label, "Last 30 Days");
    assert.equal(bitcoinChartName(label), "Bitcoin price, last 30 days");
  });

  it("puts the visible range in the combobox name", () => {
    for (const value of ["7", "30", "90", "365"]) {
      const label = btcChartRangeLabel(value);
      const name = chartRangeName(label);
      assert.equal(name.includes(label), true);
      assert.equal(name.includes("Select a value"), false);
    }
  });
});

describe("chart text", () => {
  it("formats a point as a date and a dollar price", () => {
    const date = formatChartDate("2026-09-12T01:00:00.000Z");
    assert.equal(date.includes("T01"), false);
    assert.equal(date, "Sep 12, 2026");
    assert.equal(formatChartPrice(77276.528), "$77,276.53");
  });
});
