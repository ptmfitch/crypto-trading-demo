import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideRecurringBuy,
  formatNextBuy,
  nextRecurringRunAt,
  normalizeUsdtAmount,
  RECURRING_FILLED_NOTICE,
  RECURRING_SKIP_NOTICE,
  recurringBuyView,
} from "./recurring-buy.ts";

const NOW = new Date("2026-10-08T15:15:00.000Z");

describe("normalizeUsdtAmount", () => {
  it("rounds to cents and rejects non-positive or huge amounts", () => {
    assert.equal(normalizeUsdtAmount(10.126), 10.13);
    assert.equal(normalizeUsdtAmount(0.004), null);
    assert.equal(normalizeUsdtAmount(0), null);
    assert.equal(normalizeUsdtAmount(1_000_000), 1_000_000);
    assert.equal(normalizeUsdtAmount(1_000_000.01), null);
  });
});

describe("decideRecurringBuy", () => {
  const due = new Date(NOW.getTime() - 1_000);

  it("runs a due plan only when the quote is tradable", () => {
    assert.equal(
      decideRecurringBuy({
        hasPlan: true,
        nextRunAt: due,
        now: NOW,
        tradable: true,
      }),
      "run"
    );
  });

  it("skips a due plan when the quote is not tradable", () => {
    assert.equal(
      decideRecurringBuy({
        hasPlan: true,
        nextRunAt: due,
        now: NOW,
        tradable: false,
      }),
      "skip"
    );
  });

  it("waits when the next buy is still in the future", () => {
    assert.equal(
      decideRecurringBuy({
        hasPlan: true,
        nextRunAt: new Date(NOW.getTime() + 60_000),
        now: NOW,
        tradable: true,
      }),
      "wait"
    );
  });

  it("does nothing without a plan", () => {
    assert.equal(
      decideRecurringBuy({
        hasPlan: false,
        nextRunAt: null,
        now: NOW,
        tradable: true,
      }),
      "none"
    );
  });
});

describe("nextRecurringRunAt", () => {
  it("schedules the following buy one cadence after the fill", () => {
    assert.equal(
      nextRecurringRunAt(NOW, "daily").toISOString(),
      "2026-10-09T15:15:00.000Z"
    );
    assert.equal(
      nextRecurringRunAt(NOW, "weekly").toISOString(),
      "2026-10-15T15:15:00.000Z"
    );
  });
});

describe("recurringBuyView", () => {
  const plan = {
    usdtAmount: 100,
    cadence: "daily" as const,
    nextRunAt: new Date(NOW.getTime() - 1_000),
  };

  it("shows a due buy while the quote pause skips it", () => {
    const view = recurringBuyView({
      plan,
      outcome: "skip",
      now: NOW,
    });
    assert.equal(view.nextBuyLabel, "Next buy: $100.00 daily · due now");
    assert.equal(view.notice, RECURRING_SKIP_NOTICE);
    assert.equal(view.savedAmount, 100);
  });

  it("shows the following buy after a fill", () => {
    const nextRunAt = nextRecurringRunAt(NOW, "daily");
    const view = recurringBuyView({
      plan: { ...plan, nextRunAt },
      outcome: "ran",
      now: NOW,
    });
    assert.equal(view.notice, RECURRING_FILLED_NOTICE);
    assert.equal(
      view.nextBuyLabel,
      formatNextBuy({ ...plan, nextRunAt }, NOW)
    );
    assert.match(view.nextBuyLabel, /Next buy: \$100\.00 daily · Oct 9, 2026/);
    assert.doesNotMatch(view.nextBuyLabel, /due now/);
  });

  it("shows none when the user has no plan", () => {
    const view = recurringBuyView({
      plan: null,
      outcome: "none",
      now: NOW,
    });
    assert.equal(view.nextBuyLabel, "Next buy: none");
    assert.equal(view.notice, null);
    assert.equal(view.savedCadence, "daily");
  });
});
