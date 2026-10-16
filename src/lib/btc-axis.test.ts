import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { btcAxisScale, btcDayTicks, btcPriceDomain } from "./btc-axis.ts";

describe("btcPriceDomain", () => {
  it("pads a moving series by 5% of the range", () => {
    assert.deepEqual(btcPriceDomain([100_000, 110_000]), [99_500, 110_500]);
  });

  it("gives a flat series a non-zero span", () => {
    const [low, high] = btcPriceDomain([110_000, 110_000]);
    assert.ok(high > low);
    assert.ok(low < 110_000 && high > 110_000);
  });

  it("returns a zero domain when there are no prices", () => {
    assert.deepEqual(btcPriceDomain([]), [0, 0]);
  });
});

describe("btcAxisScale", () => {
  it("labels a six-figure price in thousands, not ten times that", () => {
    const scale = btcAxisScale([108_000, 112_000]);
    assert.equal(scale.format(110_400), "$110k");
    assert.notEqual(scale.format(110_400), "$1104.0k");
  });

  it("uses one even step and ends the axis on labeled ticks", () => {
    const scale = btcAxisScale([108_000, 112_000]);
    assert.deepEqual(scale.domain, [scale.ticks[0], scale.ticks.at(-1)]);
    assert.ok(scale.domain[0] <= 108_000 && scale.domain[1] >= 112_000);
    const gaps = scale.ticks.slice(1).map((tick, index) => tick - scale.ticks[index]);
    assert.equal(new Set(gaps).size, 1);
    assert.ok(scale.ticks.length >= 4);
  });

  it("keeps a few-hundred-dollar range from collapsing onto one label", () => {
    const scale = btcAxisScale([110_200, 110_800]);
    const labels = scale.ticks.map(scale.format);
    assert.ok(labels.includes("$110.2k"));
    assert.ok(labels.includes("$110.8k"));
    assert.equal(new Set(labels).size, labels.length);
    const gaps = scale.ticks.slice(1).map((tick, index) => tick - scale.ticks[index]);
    assert.equal(new Set(gaps).size, 1);
  });

  it("formats sub-thousand prices as dollars", () => {
    const scale = btcAxisScale([800, 900]);
    assert.equal(scale.format(850), "$850");
    assert.ok(scale.ticks.length >= 2);
  });
});

describe("btcDayTicks", () => {
  it("keeps one tick per day when the series is hourly", () => {
    const points = [
      { date: "2026-10-09T00:00:00.000Z" },
      { date: "2026-10-09T12:00:00.000Z" },
      { date: "2026-10-10T00:00:00.000Z" },
      { date: "2026-10-10T12:00:00.000Z" },
      { date: "2026-10-11T00:00:00.000Z" },
    ];
    assert.deepEqual(btcDayTicks(points), [
      "2026-10-09T00:00:00.000Z",
      "2026-10-10T00:00:00.000Z",
      "2026-10-11T00:00:00.000Z",
    ]);
  });

  it("thins a long daily series to the requested count, including both ends", () => {
    const points = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    const ticks = btcDayTicks(points, 6);
    assert.equal(ticks.length, 6);
    assert.equal(ticks[0], points[0].date);
    assert.equal(ticks.at(-1), points.at(-1)?.date);
  });
});
