import { z } from "zod";

/** CoinGecko ids the demo can trade. Quote currency is always USDT. */
export const ASSETS = {
  bitcoin: { symbol: "BTC", name: "Bitcoin", decimals: 8 },
  ethereum: { symbol: "ETH", name: "Ethereum", decimals: 8 },
  solana: { symbol: "SOL", name: "Solana", decimals: 9 },
} as const;

export const ASSET_IDS = ["bitcoin", "ethereum", "solana"] as const;

export type AssetId = (typeof ASSET_IDS)[number];

export const assetIdSchema = z.enum(ASSET_IDS);

export const QUOTE_SYMBOL = "USDT";

export function isAssetId(value: string): value is AssetId {
  return (ASSET_IDS as readonly string[]).includes(value);
}

export function coinIconSrc(assetId: AssetId) {
  return `/coins/${assetId}.svg`;
}

function isSubsequence(needle: string, haystack: string) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

/** Fuzzy match on symbol and name. Empty query matches every allowlisted coin. */
export function assetMatchesQuery(
  asset: { symbol: string; name: string },
  query: string
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const fields = [asset.symbol.toLowerCase(), asset.name.toLowerCase()];
  return fields.some(
    (field) => field.includes(needle) || isSubsequence(needle, field)
  );
}
