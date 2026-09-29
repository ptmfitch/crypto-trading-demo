import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createPriceAlertError,
  duePriceAlerts,
  isPriceAlertDue,
  MAX_ACTIVE_ALERTS,
  priceAlertCrossedMessage,
  priceAlertRowLabel,
} from "./price-alert.ts";

describe("isPriceAlertDue", () => {
  it("fires above when price is at or over the threshold", () => {
    assert.equal(isPriceAlertDue("ABOVE", 100_000, 100_000), true);
    assert.equal(isPriceAlertDue("ABOVE", 100_000, 100_001), true);
    assert.equal(isPriceAlertDue("ABOVE", 100_000, 99_999), false);
  });

  it("fires below when price is at or under the threshold", () => {
    assert.equal(isPriceAlertDue("BELOW", 100_000, 100_000), true);
    assert.equal(isPriceAlertDue("BELOW", 100_000, 99_999), true);
    assert.equal(isPriceAlertDue("BELOW", 100_000, 100_001), false);
  });
});

describe("duePriceAlerts", () => {
  const alerts = [
    { id: "a", assetId: "bitcoin", direction: "ABOVE", thresholdUsd: 100 },
    { id: "b", assetId: "bitcoin", direction: "BELOW", thresholdUsd: 50 },
    { id: "c", assetId: "ethereum", direction: "ABOVE", thresholdUsd: 1 },
    { id: "d", assetId: "bitcoin", direction: "SIDEWAYS", thresholdUsd: 1 },
  ];

  it("keeps bitcoin alerts that have already crossed", () => {
    const due = duePriceAlerts(alerts, 100);
    assert.deepEqual(
      due.map((alert) => alert.id),
      ["a"]
    );
  });

  it("fires nothing without a price", () => {
    assert.deepEqual(duePriceAlerts(alerts, 0), []);
  });
});

describe("createPriceAlertError", () => {
  const valid = {
    assetId: "bitcoin",
    direction: "ABOVE",
    thresholdUsd: 100_000,
  };

  it("accepts a bitcoin alert under the cap", () => {
    assert.equal(createPriceAlertError(valid, MAX_ACTIVE_ALERTS - 1), null);
  });

  it("rejects a non-bitcoin asset", () => {
    assert.equal(
      createPriceAlertError({ ...valid, assetId: "ethereum" }, 0),
      "Only Bitcoin alerts are available."
    );
  });

  it("rejects an invalid direction or threshold", () => {
    assert.equal(
      createPriceAlertError({ ...valid, direction: "above" }, 0),
      "Invalid direction."
    );
    assert.equal(
      createPriceAlertError({ ...valid, thresholdUsd: 0 }, 0),
      "Enter a threshold above 0."
    );
  });

  it("caps active alerts at 20", () => {
    assert.equal(
      createPriceAlertError(valid, MAX_ACTIVE_ALERTS),
      "You can have at most 20 active alerts."
    );
  });
});

describe("alert copy", () => {
  it("matches the cross toast and the active row", () => {
    assert.equal(
      priceAlertCrossedMessage("ABOVE", 100_000),
      "BTC crossed $100,000 (above)"
    );
    assert.equal(
      priceAlertCrossedMessage("BELOW", 100_000.5),
      "BTC crossed $100,000.50 (below)"
    );
    assert.equal(priceAlertRowLabel("ABOVE", 100_000), "BTC · Above $100,000");
  });
});
