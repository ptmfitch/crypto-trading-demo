import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ASSET_IDS, type AssetId } from "@/lib/assets";
import {
  type CachedQuote,
  type ResolvedQuote,
} from "@/lib/btc-quote";
import {
  allowlistPriceUrl,
  cachedQuotesFromFile,
  failAllowlistUpstream,
  marketCacheFile,
  parseAllowlistPrice,
  resolveMarketQuotes,
} from "@/lib/market-price";

const CHART_URL =
  "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=";
const CHART_FRESH_TTL_MS = 900_000;
const UPSTREAM_TIMEOUT_MS = 8_000;

export const CHART_DAYS = ["7", "30", "90", "365"] as const;
export type ChartDays = (typeof CHART_DAYS)[number];

export type ChartPoint = { date: string; price: number };

type ChartCacheFile = Partial<
  Record<ChartDays, { fetchedAt: number; points: ChartPoint[] }>
>;

export type BtcQuote = Omit<ResolvedQuote, "nextCache">;

export type AssetQuote = BtcQuote;

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

function readPriceCache(): Partial<Record<AssetId, CachedQuote>> {
  return cachedQuotesFromFile(readJson(priceCachePath()));
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

async function fetchAllowlistPrices() {
  try {
    const response = await fetch(allowlistPriceUrl(), {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) return failAllowlistUpstream();
    return parseAllowlistPrice(await response.json());
  } catch (error) {
    console.error("[Market Price] upstream failed", error);
    return failAllowlistUpstream();
  }
}

function stripAll(
  quotes: Record<AssetId, ResolvedQuote>
): Record<AssetId, AssetQuote> {
  const stripped = {} as Record<AssetId, AssetQuote>;
  for (const id of ASSET_IDS) stripped[id] = strip(quotes[id]);
  return stripped;
}

export async function getMarketQuotes(): Promise<Record<AssetId, AssetQuote>> {
  const now = Date.now();
  const cached = readPriceCache();
  const cachedQuotes = resolveMarketQuotes({ now, cached, upstream: null });
  const allFresh = ASSET_IDS.every((id) => cachedQuotes[id].status === "fresh");
  if (!upstreamBlocked() && allFresh) {
    return stripAll(cachedQuotes);
  }

  const upstream = upstreamBlocked()
    ? failAllowlistUpstream()
    : await fetchAllowlistPrices();
  const resolved = resolveMarketQuotes({ now, cached, upstream });
  const merged: Partial<Record<AssetId, CachedQuote>> = { ...cached };
  let changed = false;
  for (const id of ASSET_IDS) {
    const next = resolved[id].nextCache;
    if (next) {
      merged[id] = next;
      changed = true;
    }
  }
  const file = changed ? marketCacheFile(merged) : null;
  if (file) writeJson(priceCachePath(), file);
  return stripAll(resolved);
}

export async function getBtcQuote(): Promise<BtcQuote> {
  const quotes = await getMarketQuotes();
  return quotes.bitcoin;
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

async function fetchCoinGeckoChart(days: ChartDays): Promise<ChartPoint[]> {
  const response = await fetch(`${CHART_URL}${days}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`CoinGecko chart responded ${response.status}`);
  }
  const data = (await response.json()) as { prices?: unknown };
  if (!Array.isArray(data.prices)) {
    throw new Error("CoinGecko chart payload missing prices");
  }
  const points: ChartPoint[] = [];
  for (const row of data.prices) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const [timestamp, price] = row;
    if (typeof timestamp !== "number" || typeof price !== "number") continue;
    points.push({ date: new Date(timestamp).toISOString(), price });
  }
  if (points.length === 0) throw new Error("CoinGecko chart payload was empty");
  return points;
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
