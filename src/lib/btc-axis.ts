// Y-axis labels are thousands of USD. Dividing by 100 prints $1104.0k for a $110,400 price.
const THOUSANDS = 1000;

function fractionDigits(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  let digits = 0;
  while (digits < 4 && step * 10 ** digits < 1) {
    digits += 1;
  }
  return digits;
}

function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const nice = residual <= 1.5 ? 1 : residual <= 3 ? 2 : residual <= 7 ? 5 : 10;
  return nice * magnitude;
}

function bumpStep(step: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const residual = step / magnitude;
  if (residual < 2) return 2 * magnitude;
  if (residual < 5) return 5 * magnitude;
  return 10 * magnitude;
}

function roundTo(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

export function btcPriceDomain(prices: number[]): [number, number] {
  const finite = prices.filter((price) => Number.isFinite(price));
  if (finite.length === 0) return [0, 0];

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min;
  // A flat series has no range. Pad off the price so the axis is not a single point.
  const pad = span === 0 ? Math.max(Math.abs(max) * 0.01, 1) : span * 0.05;
  return [min - pad, max + pad];
}

export type BtcAxisScale = {
  domain: [number, number];
  ticks: number[];
  format: (value: number) => string;
};

export function btcAxisScale(prices: number[], tickCount = 5): BtcAxisScale {
  const domain = btcPriceDomain(prices);
  const [low, high] = domain;
  if (!(high > low)) {
    return { domain, ticks: [], format: () => "" };
  }

  const useThousands = Math.abs(low) >= THOUSANDS && Math.abs(high) >= THOUSANDS;
  const unit = useThousands ? THOUSANDS : 1;
  const scaledLow = low / unit;
  const scaledHigh = high / unit;
  let step = niceStep((scaledHigh - scaledLow) / Math.max(tickCount - 1, 1));
  let start = 0;
  let end = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const places = fractionDigits(step) + 2;
    start = roundTo(Math.floor(scaledLow / step + 1e-8) * step, places);
    end = roundTo(Math.ceil(scaledHigh / step - 1e-8) * step, places);
    const count = Math.round((end - start) / step) + 1;
    if (count <= 8) break;
    step = bumpStep(step);
  }
  const digits = fractionDigits(step);
  const places = digits + 2;
  const ticks: number[] = [];
  for (
    let value = start;
    value <= end + step * 1e-6;
    value = roundTo(value + step, places)
  ) {
    ticks.push(roundTo(value, places) * unit);
  }
  const tickDomain: [number, number] =
    ticks.length >= 2 ? [ticks[0], ticks[ticks.length - 1]] : domain;

  const format = (value: number) => {
    if (!Number.isFinite(value)) return "";
    const sign = value < 0 ? "-" : "";
    const scaled = Math.abs(value) / unit;
    if (useThousands) return `${sign}$${scaled.toFixed(digits)}k`;
    return `${sign}$${scaled.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  };

  return { domain: tickDomain, ticks, format };
}

export function btcDayTicks(
  points: readonly { date: string }[],
  maxTicks = 8
): string[] {
  const firstOfDay: string[] = [];
  let previousDay = "";
  for (const point of points) {
    const day = point.date.slice(0, 10);
    if (!day || day === previousDay) continue;
    previousDay = day;
    firstOfDay.push(point.date);
  }
  if (firstOfDay.length <= maxTicks) return firstOfDay;

  const lastIndex = firstOfDay.length - 1;
  const ticks: string[] = [];
  for (let index = 0; index < maxTicks; index += 1) {
    ticks.push(firstOfDay[Math.round((index * lastIndex) / (maxTicks - 1))]);
  }
  return [...new Set(ticks)];
}
