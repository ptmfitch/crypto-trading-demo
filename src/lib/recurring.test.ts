import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  advanceNextRun,
  fillMessage,
  formatNextRunLabel,
  pausedDetail,
  periodOutcome,
  planActiveMessage,
  planTitle,
} from "./recurring.ts";

describe("recurring plans", () => {
  it("advances daily by one day and weekly by seven", () => {
    const from = new Date("2026-09-24T13:00:00.000Z");
    assert.equal(
      advanceNextRun(from, "DAILY").toISOString(),
      "2026-09-25T13:00:00.000Z",
    );
    assert.equal(
      advanceNextRun(from, "WEEKLY").toISOString(),
      "2026-10-01T13:00:00.000Z",
    );
  });

  it("formats the create toast, fill toast, and plan row", () => {
    const plan = {
      assetId: "bitcoin" as const,
      quoteAmount: 50,
      cadence: "WEEKLY" as const,
    };
    assert.equal(planActiveMessage(plan), "Weekly $50 BTC plan active");
    assert.equal(fillMessage(plan), "Recurring buy filled · $50 BTC");
    assert.equal(planTitle(plan), "BTC · $50 · Weekly");
    assert.equal(formatNextRunLabel(new Date("2026-09-28T00:00:00.000Z")), "Mon 28 Sep");
  });

  it("describes a paused plan from the last fill", () => {
    const now = new Date("2026-09-24T12:00:00.000Z");
    assert.equal(pausedDetail(null, now), "Paused");
    assert.equal(
      pausedDetail(new Date("2026-09-22T12:00:00.000Z"), now),
      "Paused · last fill 2d ago",
    );
    assert.equal(pausedDetail(now, now), "Paused · last fill today");
  });

  it("fills BTC when the quote and balance allow it, and skips otherwise", () => {
    assert.equal(
      periodOutcome({ assetId: "bitcoin", quoteOk: true, affordable: true }),
      "fill",
    );
    assert.equal(
      periodOutcome({ assetId: "bitcoin", quoteOk: true, affordable: false }),
      "skip",
    );
    assert.equal(
      periodOutcome({ assetId: "bitcoin", quoteOk: false, affordable: true }),
      "retry",
    );
    assert.equal(
      periodOutcome({ assetId: "ethereum", quoteOk: true, affordable: true }),
      "skip",
    );
    assert.equal(
      periodOutcome({ assetId: "solana", quoteOk: false, affordable: false }),
      "skip",
    );
  });
});
