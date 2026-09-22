import { Prisma } from "@prisma/client";

export const LEDGER_ASSETS = ["bitcoin", "ethereum", "solana"] as const;

export type LedgerAsset = (typeof LEDGER_ASSETS)[number];

export type Side = "BUY" | "SELL";

export type OrderStatus = "PENDING" | "FILLED" | "CANCELED";

export const LEDGER_SYMBOL: Record<LedgerAsset, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
};

export type Position = {
  usdt: Prisma.Decimal;
  bitcoin: Prisma.Decimal;
  ethereum: Prisma.Decimal;
  solana: Prisma.Decimal;
};

export type WorkingOrder = {
  side: Side;
  assetId: LedgerAsset;
  limitPrice: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  quoteReserved: Prisma.Decimal;
  status: OrderStatus;
};

export type BalanceBucket = "usdt" | LedgerAsset;

export type FillLeg = {
  type: Side;
  assetId: LedgerAsset;
  baseAmount: Prisma.Decimal;
  quoteAmount: Prisma.Decimal;
  priceAtTrade: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);
const QUOTE_DP = 2;
const BASE_DP = 8;
const PRICE_DP = 8;

export function emptyPosition(): Position {
  return {
    usdt: ZERO,
    bitcoin: ZERO,
    ethereum: ZERO,
    solana: ZERO,
  };
}

function isLedgerAsset(value: string): value is LedgerAsset {
  switch (value) {
    case "bitcoin":
    case "ethereum":
    case "solana":
      return true;
    default:
      return false;
  }
}

function readBase(position: Position, assetId: LedgerAsset): Prisma.Decimal {
  switch (assetId) {
    case "bitcoin":
      return position.bitcoin;
    case "ethereum":
      return position.ethereum;
    case "solana":
      return position.solana;
    default: {
      const exhaustive: never = assetId;
      return exhaustive;
    }
  }
}

function writeBase(
  position: Position,
  assetId: LedgerAsset,
  amount: Prisma.Decimal
): Position {
  switch (assetId) {
    case "bitcoin":
      return { ...position, bitcoin: amount };
    case "ethereum":
      return { ...position, ethereum: amount };
    case "solana":
      return { ...position, solana: amount };
    default: {
      const exhaustive: never = assetId;
      return exhaustive;
    }
  }
}

function readBucket(position: Position, bucket: BalanceBucket): Prisma.Decimal {
  if (bucket === "usdt") return position.usdt;
  return readBase(position, bucket);
}

function writeBucket(
  position: Position,
  bucket: BalanceBucket,
  amount: Prisma.Decimal
): Position {
  if (bucket === "usdt") return { ...position, usdt: amount };
  return writeBase(position, bucket, amount);
}

export function insufficientBalanceMessage(bucket: BalanceBucket): string {
  if (bucket === "usdt") return "Insufficient USDT balance.";
  return `Insufficient ${LEDGER_SYMBOL[bucket]} balance.`;
}

// Buy `amount` is quote USDT to lock. Sell `amount` is the base size to lock.
export function buildLimitOrder(input: {
  side: Side;
  assetId: string;
  limitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
}): WorkingOrder {
  if (!isLedgerAsset(input.assetId)) {
    throw new Error("Invalid input");
  }
  if (!input.limitPrice.isFinite() || input.limitPrice.lte(0)) {
    throw new Error("Enter a limit price.");
  }
  if (!input.amount.isFinite() || input.amount.lte(0)) {
    throw new Error("Amount must be greater than 0");
  }

  const limitPrice = input.limitPrice.toDecimalPlaces(
    PRICE_DP,
    Prisma.Decimal.ROUND_HALF_UP
  );

  switch (input.side) {
    case "BUY": {
      const quoteReserved = input.amount.toDecimalPlaces(
        QUOTE_DP,
        Prisma.Decimal.ROUND_HALF_UP
      );
      const baseAmount = quoteReserved
        .div(limitPrice)
        .toDecimalPlaces(BASE_DP, Prisma.Decimal.ROUND_DOWN);
      if (quoteReserved.lte(0) || baseAmount.lte(0)) {
        throw new Error("Amount is too small for this limit price.");
      }
      return {
        side: "BUY",
        assetId: input.assetId,
        limitPrice,
        baseAmount,
        quoteReserved,
        status: "PENDING",
      };
    }
    case "SELL": {
      const baseAmount = input.amount.toDecimalPlaces(
        BASE_DP,
        Prisma.Decimal.ROUND_DOWN
      );
      const quoteReserved = baseAmount
        .mul(limitPrice)
        .toDecimalPlaces(QUOTE_DP, Prisma.Decimal.ROUND_HALF_UP);
      if (baseAmount.lte(0) || quoteReserved.lte(0)) {
        throw new Error("Amount is too small for this limit price.");
      }
      return {
        side: "SELL",
        assetId: input.assetId,
        limitPrice,
        baseAmount,
        quoteReserved,
        status: "PENDING",
      };
    }
    default: {
      const exhaustive: never = input.side;
      throw new Error(exhaustive);
    }
  }
}

export function reservedAmount(order: {
  side: Side;
  assetId: LedgerAsset;
  baseAmount: Prisma.Decimal;
  quoteReserved: Prisma.Decimal;
}): { bucket: BalanceBucket; amount: Prisma.Decimal } {
  switch (order.side) {
    case "BUY":
      return { bucket: "usdt", amount: order.quoteReserved };
    case "SELL":
      return { bucket: order.assetId, amount: order.baseAmount };
    default: {
      const exhaustive: never = order.side;
      return exhaustive;
    }
  }
}

export function fillCredit(order: {
  side: Side;
  assetId: LedgerAsset;
  baseAmount: Prisma.Decimal;
  quoteReserved: Prisma.Decimal;
}): { bucket: BalanceBucket; amount: Prisma.Decimal } {
  switch (order.side) {
    case "BUY":
      return { bucket: order.assetId, amount: order.baseAmount };
    case "SELL":
      return { bucket: "usdt", amount: order.quoteReserved };
    default: {
      const exhaustive: never = order.side;
      return exhaustive;
    }
  }
}

function debit(position: Position, order: WorkingOrder): Position {
  const reserved = reservedAmount(order);
  const next = readBucket(position, reserved.bucket).minus(reserved.amount);
  if (next.lt(0)) {
    throw new Error(insufficientBalanceMessage(reserved.bucket));
  }
  return writeBucket(position, reserved.bucket, next);
}

function credit(position: Position, bucket: BalanceBucket, amount: Prisma.Decimal) {
  return writeBucket(position, bucket, readBucket(position, bucket).plus(amount));
}

export function reserveOnPlace(position: Position, order: WorkingOrder): Position {
  if (order.status !== "PENDING") {
    throw new Error("Order is not pending.");
  }
  return debit(position, order);
}

export function cancelPending(
  position: Position,
  order: WorkingOrder
): { position: Position; order: WorkingOrder } {
  if (order.status !== "PENDING") {
    throw new Error("Order is not pending.");
  }
  const reserved = reservedAmount(order);
  return {
    position: credit(position, reserved.bucket, reserved.amount),
    order: { ...order, status: "CANCELED" },
  };
}

export function crossesLimit(
  side: Side,
  live: Prisma.Decimal,
  limit: Prisma.Decimal
): boolean {
  switch (side) {
    case "BUY":
      return live.lte(limit);
    case "SELL":
      return live.gte(limit);
    default: {
      const exhaustive: never = side;
      return exhaustive;
    }
  }
}

// A crossed order fills entirely at its limit. The live print only decides whether it crosses.
export function fillTrade(
  order: WorkingOrder,
  live: Prisma.Decimal
): FillLeg | null {
  if (order.status !== "PENDING") return null;
  if (!live.isFinite() || live.lte(0)) return null;
  if (!crossesLimit(order.side, live, order.limitPrice)) return null;
  return {
    type: order.side,
    assetId: order.assetId,
    baseAmount: order.baseAmount,
    quoteAmount: order.quoteReserved,
    priceAtTrade: order.limitPrice,
  };
}

export function creditFill(position: Position, order: WorkingOrder): Position {
  if (order.status !== "PENDING") {
    throw new Error("Order is not pending.");
  }
  const creditLeg = fillCredit(order);
  return credit(position, creditLeg.bucket, creditLeg.amount);
}
