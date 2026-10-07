export const MAX_CHART_SPAN_DAYS = 365;

export type ChartPoint = { date: string; price: number };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export type ChartRange =
  | { ok: true; from: string; to: string }
  | { ok: false; error: string };

// `today` is a UTC calendar day. Future start and end dates are clamped to
// today — the date picker can offer a local day that is still tomorrow in UTC.
// The span cap matches the longest preset so a custom window stays demo-sized.
export function parseChartRange(
  fromRaw: string | null,
  toRaw: string | null,
  todayRaw: string
): ChartRange {
  const from = parseIsoDate(fromRaw);
  const to = parseIsoDate(toRaw);
  const today = parseIsoDate(todayRaw);
  if (!from || !to || !today) {
    return { ok: false, error: "Use dates in YYYY-MM-DD format." };
  }
  if (from > to) {
    return {
      ok: false,
      error: "The start date must be on or before the end date.",
    };
  }
  const start = from > today ? today : from;
  const end = to > today ? today : to;
  const spanDays = Math.round(
    (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) /
      86_400_000
  );
  if (spanDays > MAX_CHART_SPAN_DAYS) {
    return { ok: false, error: "Choose a range of 365 days or less." };
  }
  return { ok: true, from: start, to: end };
}

export function filterChartPoints(
  points: ChartPoint[],
  from: string,
  to: string
): ChartPoint[] {
  return points.filter((point) => {
    const day = point.date.slice(0, 10);
    return day >= from && day <= to;
  });
}

export function chartRangeUnix(from: string, to: string) {
  return {
    fromUnix: Math.floor(Date.parse(`${from}T00:00:00.000Z`) / 1000),
    toUnix: Math.floor(Date.parse(`${to}T23:59:59.000Z`) / 1000),
  };
}

export function chartPointsFromRows(rows: unknown): ChartPoint[] {
  if (!Array.isArray(rows)) return [];
  const points: ChartPoint[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const [timestamp, price] = row;
    if (typeof timestamp !== "number" || typeof price !== "number") continue;
    if (!Number.isFinite(timestamp) || !Number.isFinite(price)) continue;
    points.push({ date: new Date(timestamp).toISOString(), price });
  }
  return points;
}

export function formatChartDay(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  return new Date(`${parsed}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function chartFilterLabel(from: string, to: string): string {
  return `Filtered to ${formatChartDay(from)} – ${formatChartDay(to)}`;
}
