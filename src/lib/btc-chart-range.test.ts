import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chartFilterLabel,
  chartPointsFromRows,
  chartRangeUnix,
  filterChartPoints,
  parseChartRange,
  parseIsoDate,
} from "./btc-chart-range.ts";

const TODAY = "2026-10-07";

describe("parseIsoDate", () => {
  it("accepts a real calendar day", () => {
    assert.equal(parseIsoDate("2024-02-29"), "2024-02-29");
  });

  it("rejects impossible days and partial values", () => {
    assert.equal(parseIsoDate("2023-02-29"), null);
    assert.equal(parseIsoDate("2026-10-7"), null);
    assert.equal(parseIsoDate(""), null);
    assert.equal(parseIsoDate(null), null);
  });
});

describe("parseChartRange", () => {
  it("keeps an inclusive window and clamps a future end date", () => {
    assert.deepEqual(parseChartRange("2026-09-24", "2026-10-20", TODAY), {
      ok: true,
      from: "2026-09-24",
      to: TODAY,
    });
  });

  it("allows a single day and a 365-day span", () => {
    assert.deepEqual(parseChartRange("2026-10-01", "2026-10-01", TODAY), {
      ok: true,
      from: "2026-10-01",
      to: "2026-10-01",
    });
    assert.deepEqual(parseChartRange("2025-10-07", TODAY, TODAY), {
      ok: true,
      from: "2025-10-07",
      to: TODAY,
    });
  });

  it("rejects an inverted window, a future start, and a span past 365 days", () => {
    assert.equal(
      parseChartRange("2026-10-05", "2026-10-01", TODAY).ok,
      false
    );
    assert.equal(
      parseChartRange("2026-10-05", "2026-10-01", TODAY).error,
      "The start date must be on or before the end date."
    );
    assert.equal(
      parseChartRange("2026-10-08", "2026-10-09", TODAY).error,
      "The start date cannot be in the future."
    );
    assert.equal(
      parseChartRange("2025-10-06", TODAY, TODAY).error,
      "Choose a range of 365 days or less."
    );
  });
});

describe("filterChartPoints", () => {
  const points = [
    { date: "2026-09-23T23:00:00.000Z", price: 1 },
    { date: "2026-09-24T00:30:00.000Z", price: 2 },
    { date: "2026-10-01T18:00:00.000Z", price: 3 },
    { date: "2026-10-02T00:00:00.000Z", price: 4 },
  ];

  it("keeps points whose UTC day falls inside the window", () => {
    assert.deepEqual(
      filterChartPoints(points, "2026-09-24", "2026-10-01").map((point) => point.price),
      [2, 3]
    );
  });
});

describe("chart helpers", () => {
  it("builds unix bounds for the UTC day", () => {
    assert.deepEqual(chartRangeUnix("2026-10-01", "2026-10-01"), {
      fromUnix: Math.floor(Date.parse("2026-10-01T00:00:00.000Z") / 1000),
      toUnix: Math.floor(Date.parse("2026-10-01T23:59:59.000Z") / 1000),
    });
  });

  it("reads CoinGecko price rows and skips malformed ones", () => {
    const points = chartPointsFromRows([
      [Date.parse("2026-10-01T12:00:00.000Z"), 64000],
      ["bad", 1],
      [Date.parse("2026-10-02T12:00:00.000Z"), Number.NaN],
    ]);
    assert.equal(points.length, 1);
    assert.equal(points[0].price, 64000);
    assert.equal(points[0].date, "2026-10-01T12:00:00.000Z");
  });

  it("formats the filter sentence in UTC", () => {
    assert.equal(
      chartFilterLabel("2026-09-24", "2026-10-01"),
      "Filtered to Sep 24, 2026 – Oct 1, 2026"
    );
  });
});
