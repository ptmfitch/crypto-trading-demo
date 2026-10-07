import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  chartPointsFromRows,
  chartRangeUnix,
  filterChartPoints,
  type ChartPoint,
} from "@/lib/btc-chart-range";
import {
  type CachedQuote,
  type ResolvedQuote,
  resolveBtcQuote,
  type UpstreamQuote,
} from "@/lib/btc-quote";

export type { ChartPoint };

const PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true";
const CHART_URL =
  "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=";
const CHART_RANGE_URL =
  "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=";
const CHART_FRESH_TTL_MS = 900_000;
const UPSTREAM_TIMEOUT_MS = 8_000;

export const CHART_DAYS = ["7", "30", "90", "365"] as const;
export type ChartDays = (typeof CHART_DAYS)[number];

type ChartCacheEntry = { fetchedAt: number; points: ChartPoint[] };

type ChartCacheFile = Partial<Record<ChartDays, ChartCacheEntry>> & {
  ranges?: Record<string, ChartCacheEntry>;
};

const MAX_RANGE_CACHE = 8;

export type BtcQuote = Omit<ResolvedQuote, "nextCache">;

export type BtcChart = {
  status: BtcQuote["status"];
  points: ChartPoint[];
};

function priceCachePath() {
  return (
    process.env.BTC_PRICE_CACHE_FILE ||
    path.join(os.tmpdir(), "tradesim-btc-price-cache.json")
  );
}

function chartCachePath() {
  return (
    process.env.BTC_CHART_CACHE_FILE ||
    path.join(os.tmpdir(), "tradesim-btc-chart-cache.json")
  );
}

// Read on each quote so a verification run can pause CoinGecko without a restart.
// Ignored unless BTC_PRICE_FAULT_FILE is set, or BTC_PRICE_FAULT=fail.
function upstreamBlocked() {
  if (process.env.BTC_PRICE_FAULT === "fail") return true;
  const faultFile = process.env.BTC_PRICE_FAULT_FILE;
  if (!faultFile) return false;
  try {
    return fs.readFileSync(faultFile, "utf8").trim() === "fail";
  } catch {
    return false;
  }
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

function readPriceCache(): CachedQuote | null {
  const parsed = readJson(priceCachePath());
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Partial<CachedQuote>;
  if (typeof row.usd !== "number" || typeof row.fetchedAt !== "number") {
    return null;
  }
  return {
    usd: row.usd,
    usd24hChange:
      typeof row.usd24hChange === "number" ? row.usd24hChange : null,
    fetchedAt: row.fetchedAt,
  };
}

function strip(quote: ResolvedQuote): BtcQuote {
  return {
    usd: quote.usd,
    usd24hChange: quote.usd24hChange,
    status: quote.status,
    fetchedAt: quote.fetchedAt,
    ageMs: quote.ageMs,
  };
}

async function fetchCoinGeckoPrice(): Promise<UpstreamQuote> {
  try {
    const response = await fetch(PRICE_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false };
    const data = (await response.json()) as {
      bitcoin?: { usd?: unknown; usd_24h_change?: unknown };
    };
    const usd = data.bitcoin?.usd;
    const change = data.bitcoin?.usd_24h_change;
    if (typeof usd !== "number") return { ok: false };
    return {
      ok: true,
      usd,
      usd24hChange: typeof change === "number" ? change : null,
    };
  } catch (error) {
    console.error("[BTC Price] upstream failed", error);
    return { ok: false };
  }
}

export async function getBtcQuote(): Promise<BtcQuote> {
  const now = Date.now();
  const cached = readPriceCache();
  const cachedQuote = resolveBtcQuote({ now, cached, upstream: null });
  if (!upstreamBlocked() && cachedQuote.status === "fresh") {
    return strip(cachedQuote);
  }

  const upstream = upstreamBlocked()
    ? ({ ok: false } as const)
    : await fetchCoinGeckoPrice();
  const resolved = resolveBtcQuote({ now, cached, upstream });
  if (resolved.nextCache) writeJson(priceCachePath(), resolved.nextCache);
  return strip(resolved);
}

export function parseChartDays(value: string | null): ChartDays | null {
  if (value == null || value === "") return "30";
  return CHART_DAYS.includes(value as ChartDays) ? (value as ChartDays) : null;
}

function readChartEntry(days: ChartDays) {
  const parsed = readJson(chartCachePath());
  if (!parsed || typeof parsed !== "object") return null;
  const entry = (parsed as ChartCacheFile)[days];
  if (!entry || !Array.isArray(entry.points) || entry.points.length === 0) {
    return null;
  }
  if (!Number.isFinite(entry.fetchedAt)) return null;
  const points = entry.points.filter(
    (point) =>
      point &&
      typeof point.date === "string" &&
      typeof point.price === "number" &&
      Number.isFinite(point.price)
  );
  if (points.length === 0) return null;
  return { fetchedAt: entry.fetchedAt, points };
}

async function fetchCoinGeckoPrices(url: string): Promise<ChartPoint[]> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`CoinGecko chart responded ${response.status}`);
  }
  const data = (await response.json()) as { prices?: unknown };
  const points = chartPointsFromRows(data.prices);
  if (points.length === 0) throw new Error("CoinGecko chart payload was empty");
  return points;
}

async function fetchCoinGeckoChart(days: ChartDays): Promise<ChartPoint[]> {
  return fetchCoinGeckoPrices(`${CHART_URL}${days}`);
}

async function fetchCoinGeckoChartRange(
  from: string,
  to: string
): Promise<ChartPoint[]> {
  const { fromUnix, toUnix } = chartRangeUnix(from, to);
  const points = await fetchCoinGeckoPrices(
    `${CHART_RANGE_URL}${fromUnix}&to=${toUnix}`
  );
  return filterChartPoints(points, from, to);
}

export async function getBtcChart(days: ChartDays): Promise<BtcChart> {
  const cached = readChartEntry(days);
  const age = cached ? Date.now() - cached.fetchedAt : Number.POSITIVE_INFINITY;
  if (!upstreamBlocked() && cached && age >= 0 && age < CHART_FRESH_TTL_MS) {
    return { status: "fresh", points: cached.points };
  }
  if (upstreamBlocked()) {
    return cached
      ? { status: "stale", points: cached.points }
      : { status: "unavailable", points: [] };
  }

  try {
    const points = await fetchCoinGeckoChart(days);
    const parsed = readJson(chartCachePath());
    const file: ChartCacheFile =
      parsed && typeof parsed === "object" ? (parsed as ChartCacheFile) : {};
    file[days] = { fetchedAt: Date.now(), points };
    writeJson(chartCachePath(), file);
    return { status: "fresh", points };
  } catch (error) {
    console.error("[BTC Chart] upstream failed", error);
    return cached
      ? { status: "stale", points: cached.points }
      : { status: "unavailable", points: [] };
  }
}

function readRangeEntry(from: string, to: string) {
  const parsed = readJson(chartCachePath());
  if (!parsed || typeof parsed !== "object") return null;
  const entry = (parsed as ChartCacheFile).ranges?.[`${from}:${to}`];
  if (!entry || !Array.isArray(entry.points) || entry.points.length === 0) {
    return null;
  }
  if (!Number.isFinite(entry.fetchedAt)) return null;
  const points = entry.points.filter(
    (point) =>
      point &&
      typeof point.date === "string" &&
      typeof point.price === "number" &&
      Number.isFinite(point.price)
  );
  if (points.length === 0) return null;
  return { fetchedAt: entry.fetchedAt, points };
}

function writeRangeEntry(from: string, to: string, points: ChartPoint[]) {
  const parsed = readJson(chartCachePath());
  const file: ChartCacheFile =
    parsed && typeof parsed === "object" ? (parsed as ChartCacheFile) : {};
  const ranges = { ...(file.ranges ?? {}) };
  ranges[`${from}:${to}`] = { fetchedAt: Date.now(), points };
  const newest = Object.entries(ranges)
    .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)
    .slice(-MAX_RANGE_CACHE);
  file.ranges = Object.fromEntries(newest);
  writeJson(chartCachePath(), file);
}

export async function getBtcChartRange(
  from: string,
  to: string
): Promise<BtcChart> {
  const cached = readRangeEntry(from, to);
  const age = cached ? Date.now() - cached.fetchedAt : Number.POSITIVE_INFINITY;
  if (!upstreamBlocked() && cached && age >= 0 && age < CHART_FRESH_TTL_MS) {
    return {
      status: "fresh",
      points: filterChartPoints(cached.points, from, to),
    };
  }
  if (upstreamBlocked()) {
    return cached
      ? { status: "stale", points: filterChartPoints(cached.points, from, to) }
      : { status: "unavailable", points: [] };
  }

  try {
    const points = await fetchCoinGeckoChartRange(from, to);
    if (points.length > 0) writeRangeEntry(from, to, points);
    return { status: "fresh", points };
  } catch (error) {
    console.error("[BTC Chart] upstream failed", error);
    return cached
      ? { status: "stale", points: filterChartPoints(cached.points, from, to) }
      : { status: "unavailable", points: [] };
  }
}
