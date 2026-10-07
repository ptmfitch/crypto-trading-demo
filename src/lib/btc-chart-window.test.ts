import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chartDateIssue,
  chartDateMessage,
  chartDaysForWindow,
  chartHistoryStart,
  clampChartDate,
  filterPointsByDateWindow,
} from "./btc-chart-window.ts";

const TODAY = "2026-10-07";

describe("chart date window", () => {
  it("accepts an inclusive window inside the last year", () => {
    assert.equal(chartDateIssue("2026-09-01", "2026-10-07", TODAY), null);
    assert.equal(chartHistoryStart(TODAY), "2025-10-07");
  });

  it("rejects an end date before the start date", () => {
    assert.equal(
      chartDateIssue("2026-10-06", "2026-10-01", TODAY),
      "end-before-start"
    );
    assert.equal(
      chartDateMessage("end-before-start"),
      "End date is before the start date."
    );
  });

  it("clamps future dates to today", () => {
    assert.deepEqual(clampChartDate("2026-10-08", TODAY), {
      value: TODAY,
      issue: "future",
    });
    assert.equal(chartDateIssue("2026-10-08", TODAY, TODAY), "future");
    assert.equal(chartDateMessage("future"), "Dates cannot be in the future.");
  });

  it("clamps dates older than the price history", () => {
    assert.deepEqual(clampChartDate("2020-01-01", TODAY), {
      value: "2025-10-07",
      issue: "too-old",
    });
    assert.equal(chartDateIssue("2020-01-01", TODAY, TODAY), "too-old");
    assert.equal(
      chartDateMessage("too-old"),
      "Price history only goes back 1 year."
    );
  });

  it("picks the shortest preset that still includes the start date", () => {
    assert.equal(chartDaysForWindow(TODAY, TODAY), "7");
    assert.equal(chartDaysForWindow("2026-09-30", TODAY), "7");
    assert.equal(chartDaysForWindow("2026-09-29", TODAY), "30");
    assert.equal(chartDaysForWindow("2026-09-07", TODAY), "30");
    assert.equal(chartDaysForWindow("2026-09-06", TODAY), "90");
    assert.equal(chartDaysForWindow("2026-07-09", TODAY), "90");
    assert.equal(chartDaysForWindow("2026-07-08", TODAY), "365");
    assert.equal(chartDaysForWindow("2025-10-07", TODAY), "365");
    assert.equal(chartDaysForWindow("2025-10-06", TODAY), null);
  });

  it("keeps points whose calendar day falls inside the window", () => {
    const points = [
      { date: "2026-10-01T23:00:00.000Z", price: 1 },
      { date: "2026-10-02T03:00:00.000Z", price: 2 },
      { date: "2026-10-03T12:00:00.000Z", price: 3 },
      { date: "2026-10-04T00:00:00.000Z", price: 4 },
    ];

    const utc = filterPointsByDateWindow(
      points,
      "2026-10-02",
      "2026-10-03",
      "UTC"
    );
    assert.deepEqual(
      utc.map((point) => point.price),
      [2, 3]
    );

    const eastern = filterPointsByDateWindow(
      points,
      "2026-10-01",
      "2026-10-01",
      "America/New_York"
    );
    assert.deepEqual(
      eastern.map((point) => point.price),
      [1, 2]
    );
  });
});
