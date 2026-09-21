import { ASSET_IDS, type AssetId } from "./assets.ts";
import {
  resolveBtcQuote,
  type CachedQuote,
  type ResolvedQuote,
  type UpstreamQuote,
} from "./btc-quote.ts";

export function allowlistPriceUrl() {
  const ids = ASSET_IDS.join(",");
  return `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
}

export function parseAllowlistPrice(
  payload: unknown
): Record<AssetId, UpstreamQuote> {
  const body =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const quotes = {} as Record<AssetId, UpstreamQuote>;
  for (const id of ASSET_IDS) {
    const row = body[id];
    if (!row || typeof row !== "object") {
      quotes[id] = { ok: false };
      continue;
    }
    const record = row as { usd?: unknown; usd_24h_change?: unknown };
    const change = record.usd_24h_change;
    if (typeof record.usd !== "number" || !Number.isFinite(record.usd) || record.usd <= 0) {
      quotes[id] = { ok: false };
      continue;
    }
    quotes[id] = {
      ok: true,
      usd: record.usd,
      usd24hChange:
        typeof change === "number" && Number.isFinite(change) ? change : null,
    };
  }
  return quotes;
}

export function failAllowlistUpstream(): Record<AssetId, UpstreamQuote> {
  const quotes = {} as Record<AssetId, UpstreamQuote>;
  for (const id of ASSET_IDS) quotes[id] = { ok: false };
  return quotes;
}

export function resolveMarketQuotes(input: {
  now: number;
  cached: Partial<Record<AssetId, CachedQuote | null>>;
  upstream: Record<AssetId, UpstreamQuote> | null;
}): Record<AssetId, ResolvedQuote> {
  const quotes = {} as Record<AssetId, ResolvedQuote>;
  for (const id of ASSET_IDS) {
    quotes[id] = resolveBtcQuote({
      now: input.now,
      cached: input.cached[id] ?? null,
      upstream: input.upstream ? input.upstream[id] : null,
    });
  }
  return quotes;
}

function readCachedQuote(value: unknown): CachedQuote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CachedQuote>;
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

/** Accept the legacy single-bitcoin cache file and the allowlist `quotes` map. */
export function cachedQuotesFromFile(
  parsed: unknown
): Partial<Record<AssetId, CachedQuote>> {
  if (!parsed || typeof parsed !== "object") return {};
  const row = parsed as { quotes?: unknown };
  const quotes: Partial<Record<AssetId, CachedQuote>> = {};
  if (row.quotes && typeof row.quotes === "object") {
    const map = row.quotes as Record<string, unknown>;
    for (const id of ASSET_IDS) {
      const cached = readCachedQuote(map[id]);
      if (cached) quotes[id] = cached;
    }
  }
  if (!quotes.bitcoin) {
    const legacy = readCachedQuote(parsed);
    if (legacy) quotes.bitcoin = legacy;
  }
  return quotes;
}

/** Top-level `usd` stays the bitcoin quote so the verifier can read the cache file. */
export function marketCacheFile(
  quotes: Partial<Record<AssetId, CachedQuote>>
) {
  const bitcoin = quotes.bitcoin;
  if (!bitcoin) return null;
  return {
    usd: bitcoin.usd,
    usd24hChange: bitcoin.usd24hChange,
    fetchedAt: bitcoin.fetchedAt,
    quotes,
  };
}
