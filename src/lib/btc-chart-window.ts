export const CHART_HISTORY_DAYS = 365;

export const chartPresetDays = ["7", "30", "90", "365"] as const;
export type ChartPresetDays = (typeof chartPresetDays)[number];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ChartDateIssue = "future" | "too-old" | "end-before-start";

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function addCalendarDays(isoDate: string, days: number): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return isoDate;
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function chartHistoryStart(today: string): string {
  return addCalendarDays(today, -CHART_HISTORY_DAYS);
}

export function chartDateMessage(issue: ChartDateIssue): string {
  switch (issue) {
    case "future":
      return "Dates cannot be in the future.";
    case "too-old":
      return "Price history only goes back 1 year.";
    case "end-before-start":
      return "End date is before the start date.";
  }
}

export function clampChartDate(
  value: string,
  today: string
): { value: string; issue: Exclude<ChartDateIssue, "end-before-start"> | null } {
  if (!isIsoDate(value) || !isIsoDate(today)) return { value: "", issue: null };
  const min = chartHistoryStart(today);
  if (value > today) return { value: today, issue: "future" };
  if (value < min) return { value: min, issue: "too-old" };
  return { value, issue: null };
}

/** Valid, ordered window inside the history the chart API can return. */
export function chartDateIssue(
  start: string,
  end: string,
  today: string
): ChartDateIssue | null {
  if (!isIsoDate(start) || !isIsoDate(end) || !isIsoDate(today)) return null;
  const min = chartHistoryStart(today);
  if (start > today || end > today) return "future";
  if (start < min || end < min) return "too-old";
  if (end < start) return "end-before-start";
  return null;
}

function calendarDaysBetween(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * CoinGecko is requested with a preset lookback, not an arbitrary range.
 * Pick the shortest preset that still includes `start`.
 */
export function chartDaysForWindow(
  start: string,
  today: string
): ChartPresetDays | null {
  if (chartDateIssue(start, start, today)) return null;
  const lookback = calendarDaysBetween(start, today);
  const needed = Math.max(lookback, 1);
  for (const preset of chartPresetDays) {
    if (Number(preset) >= needed) return preset;
  }
  return null;
}

export function pointCalendarDay(
  timestamp: string,
  timeZone: string
): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function filterPointsByDateWindow<T extends { date: string }>(
  points: T[],
  start: string,
  end: string,
  timeZone: string
): T[] {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return [];
  return points.filter((point) => {
    const day = pointCalendarDay(point.date, timeZone);
    return day != null && day >= start && day <= end;
  });
}
