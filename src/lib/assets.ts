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

export const PENDING_ORDER_LIMIT = 50;

export type OrderView = {
  id: string;
  side: OrderSide;
  assetId: AssetId;
  limitPrice: number;
  baseAmount: number;
  quoteReserved: number;
};

export type OrderRow = OrderView & { phase: "pending" | "filled" };

// A refresh can arrive before the tick response. Keep an optimistic row until
// the server has listed it, and treat a listed row that then vanishes as a fill
// so the card can flash instead of disappearing.
export function mergePendingRows(
  current: OrderRow[],
  serverPending: OrderView[],
  seenOnServer: ReadonlySet<string>,
  canceledIds: ReadonlySet<string>
): { rows: OrderRow[]; justFilled: OrderView[] } {
  const serverIds = new Set(serverPending.map((order) => order.id));
  const justFilled = current.filter(
    (row) =>
      row.phase === "pending" &&
      seenOnServer.has(row.id) &&
      !serverIds.has(row.id) &&
      !canceledIds.has(row.id)
  );
  const filled = new Map<string, OrderRow>();
  for (const row of current) {
    if (canceledIds.has(row.id) || row.phase !== "filled") continue;
    filled.set(row.id, row);
  }
  for (const row of justFilled) {
    filled.set(row.id, { ...row, phase: "filled" });
  }
  const rows: OrderRow[] = [];
  const seen = new Set<string>();
  for (const order of serverPending) {
    if (filled.has(order.id) || canceledIds.has(order.id)) continue;
    rows.push({ ...order, phase: "pending" });
    seen.add(order.id);
  }
  for (const row of current) {
    if (row.phase !== "pending" || seen.has(row.id) || filled.has(row.id)) continue;
    if (canceledIds.has(row.id) || seenOnServer.has(row.id)) continue;
    rows.push(row);
    seen.add(row.id);
  }
  rows.push(...filled.values());
  return { rows, justFilled };
}

export type SpotBalances = {
  usdt: number;
  bitcoin: number;
  ethereum: number;
  solana: number;
};

// Wallet rows store spendable balances. Pending buys lock USDT and pending
// sells lock the base asset, so equity has to add those reserves back.
export function balancesIncludingReserves(
  available: SpotBalances,
  orders: Pick<OrderView, "side" | "assetId" | "baseAmount" | "quoteReserved">[]
): SpotBalances {
  let usdt = available.usdt;
  let bitcoin = available.bitcoin;
  let ethereum = available.ethereum;
  let solana = available.solana;
  for (const order of orders) {
    switch (order.side) {
      case "BUY":
        usdt += order.quoteReserved;
        break;
      case "SELL":
        switch (order.assetId) {
          case "bitcoin":
            bitcoin += order.baseAmount;
            break;
          case "ethereum":
            ethereum += order.baseAmount;
            break;
          case "solana":
            solana += order.baseAmount;
            break;
          default: {
            const exhaustive: never = order.assetId;
            return exhaustive;
          }
        }
        break;
      default: {
        const exhaustive: never = order.side;
        return exhaustive;
      }
    }
  }
  return { usdt, bitcoin, ethereum, solana };
}

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
