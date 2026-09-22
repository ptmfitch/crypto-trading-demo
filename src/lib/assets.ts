export const ASSET_IDS = ["bitcoin", "ethereum", "solana"] as const;

export type AssetId = (typeof ASSET_IDS)[number];

export const ASSET_SYMBOL: Record<AssetId, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
};

export function isAssetId(value: string): value is AssetId {
  switch (value) {
    case "bitcoin":
    case "ethereum":
    case "solana":
      return true;
    default:
      return false;
  }
}

export function assetSymbol(assetId: AssetId): string {
  switch (assetId) {
    case "bitcoin":
      return "BTC";
    case "ethereum":
      return "ETH";
    case "solana":
      return "SOL";
    default: {
      const exhaustive: never = assetId;
      return exhaustive;
    }
  }
}

export type OrderSide = "BUY" | "SELL";

export type OrderView = {
  id: string;
  side: OrderSide;
  assetId: AssetId;
  limitPrice: number;
  baseAmount: number;
  quoteReserved: number;
};

export function toOrderView(input: {
  id: string;
  side: string;
  assetId: string;
  limitPrice: number;
  baseAmount: number;
  quoteReserved: number;
}): OrderView | null {
  if (input.side !== "BUY" && input.side !== "SELL") return null;
  if (!isAssetId(input.assetId)) return null;
  if (
    !Number.isFinite(input.limitPrice) ||
    !Number.isFinite(input.baseAmount) ||
    !Number.isFinite(input.quoteReserved)
  ) {
    return null;
  }
  return {
    id: input.id,
    side: input.side,
    assetId: input.assetId,
    limitPrice: input.limitPrice,
    baseAmount: input.baseAmount,
    quoteReserved: input.quoteReserved,
  };
}

export function formatQuoteUsd(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatBaseQty(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function formatFillToast(
  side: OrderSide,
  assetId: AssetId,
  base: number,
  limit: number
): string {
  const verb = side === "BUY" ? "buy" : "sell";
  const price = limit.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `Limit ${verb} filled · ${formatBaseQty(base)} ${assetSymbol(assetId)} at $${price}`;
}
