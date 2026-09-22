"use server";

import { auth } from "@/auth";
import {
  formatFillToast,
  isAssetId,
  PENDING_ORDER_LIMIT,
  toOrderView,
  type AssetId,
  type OrderSide,
  type OrderView,
} from "@/lib/assets";
import { getAssetPrices } from "@/lib/btc-market";
import {
  buildLimitOrder,
  fillCredit,
  fillTrade,
  insufficientBalanceMessage,
  reservedAmount,
  type BalanceBucket,
  type WorkingOrder,
} from "@/lib/limit-order";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const PlaceSchema = z.object({
  side: z.enum(["BUY", "SELL"]),
  assetId: z.enum(["bitcoin", "ethereum", "solana"]),
  limitPrice: z.number().positive().finite(),
  amount: z.number().positive().finite(),
});

export type FillNotice = {
  id: string;
  message: string;
  side: OrderSide;
  assetId: AssetId;
  baseAmount: number;
  limitPrice: number;
};

type Tx = Prisma.TransactionClient;

function revalidateTrading() {
  revalidatePath("/dashboard");
  revalidatePath("/profile");
}

function actionError(error: unknown) {
  let message = "Trade failed.";
  if (error instanceof Error && error.message) message = error.message;
  return { error: message };
}

function viewFromRow(order: {
  id: string;
  side: string;
  assetId: string;
  limitPrice: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  quoteReserved: Prisma.Decimal;
}): OrderView | null {
  return toOrderView({
    id: order.id,
    side: order.side,
    assetId: order.assetId,
    limitPrice: Number(order.limitPrice.toString()),
    baseAmount: Number(order.baseAmount.toString()),
    quoteReserved: Number(order.quoteReserved.toString()),
  });
}

async function decrementIfEnough(
  tx: Tx,
  userId: string,
  bucket: BalanceBucket,
  amount: Prisma.Decimal
) {
  const message = insufficientBalanceMessage(bucket);
  switch (bucket) {
    case "usdt": {
      const updated = await tx.wallet.updateMany({
        where: { userId, usdtBalance: { gte: amount } },
        data: { usdtBalance: { decrement: amount } },
      });
      if (updated.count !== 1) throw new Error(message);
      return;
    }
    case "bitcoin": {
      const updated = await tx.wallet.updateMany({
        where: { userId, btcBalance: { gte: amount } },
        data: { btcBalance: { decrement: amount } },
      });
      if (updated.count !== 1) throw new Error(message);
      return;
    }
    case "ethereum": {
      const updated = await tx.wallet.updateMany({
        where: { userId, ethBalance: { gte: amount } },
        data: { ethBalance: { decrement: amount } },
      });
      if (updated.count !== 1) throw new Error(message);
      return;
    }
    case "solana": {
      const updated = await tx.wallet.updateMany({
        where: { userId, solBalance: { gte: amount } },
        data: { solBalance: { decrement: amount } },
      });
      if (updated.count !== 1) throw new Error(message);
      return;
    }
    default: {
      const exhaustive: never = bucket;
      throw new Error(exhaustive);
    }
  }
}

async function incrementBucket(
  tx: Tx,
  userId: string,
  bucket: BalanceBucket,
  amount: Prisma.Decimal
) {
  switch (bucket) {
    case "usdt":
      await tx.wallet.update({
        where: { userId },
        data: { usdtBalance: { increment: amount } },
      });
      return;
    case "bitcoin":
      await tx.wallet.update({
        where: { userId },
        data: { btcBalance: { increment: amount } },
      });
      return;
    case "ethereum":
      await tx.wallet.update({
        where: { userId },
        data: { ethBalance: { increment: amount } },
      });
      return;
    case "solana":
      await tx.wallet.update({
        where: { userId },
        data: { solBalance: { increment: amount } },
      });
      return;
    default: {
      const exhaustive: never = bucket;
      throw new Error(exhaustive);
    }
  }
}

export async function placeLimitOrder(values: z.infer<typeof PlaceSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const parsed = PlaceSchema.safeParse(values);
  if (!parsed.success) return { error: "Invalid input" };

  const userId = session.user.id;
  try {
    const order = buildLimitOrder({
      side: parsed.data.side,
      assetId: parsed.data.assetId,
      limitPrice: new Prisma.Decimal(parsed.data.limitPrice.toString()),
      amount: new Prisma.Decimal(parsed.data.amount.toString()),
    });
    const reserved = reservedAmount(order);
    const created = await prisma.$transaction(async (tx) => {
      await decrementIfEnough(tx, userId, reserved.bucket, reserved.amount);
      return tx.order.create({
        data: {
          userId,
          side: order.side,
          assetId: order.assetId,
          limitPrice: order.limitPrice,
          baseAmount: order.baseAmount,
          quoteReserved: order.quoteReserved,
          status: "PENDING",
        },
      });
    });
    revalidateTrading();
    const view = viewFromRow(created);
    if (!view) return { error: "Trade failed." };
    return { order: view };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelLimitOrder(orderId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!orderId) return { error: "Invalid input" };

  const userId = session.user.id;
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id: orderId, userId },
      });
      if (
        !existing ||
        existing.status !== "PENDING" ||
        !isAssetId(existing.assetId) ||
        (existing.side !== "BUY" && existing.side !== "SELL")
      ) {
        throw new Error("Order is not pending.");
      }
      // Claim before releasing the reserve so a fill tick cannot credit too.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, userId, status: "PENDING" },
        data: { status: "CANCELED", canceledAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("Order is not pending.");
      const reserved = reservedAmount({
        side: existing.side,
        assetId: existing.assetId,
        baseAmount: existing.baseAmount,
        quoteReserved: existing.quoteReserved,
      });
      await incrementBucket(tx, userId, reserved.bucket, reserved.amount);
    });
    revalidateTrading();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function tickLimitOrders(): Promise<
  | { ok: true; filled: FillNotice[]; pending: OrderView[] }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated" };
  const userId = session.user.id;

  const pendingRows = await prisma.order.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: PENDING_ORDER_LIMIT,
  });
  const assetIds = pendingRows.flatMap((order) =>
    isAssetId(order.assetId) ? [order.assetId] : []
  );
  const prices = assetIds.length > 0 ? await getAssetPrices(assetIds) : {};
  const filled: FillNotice[] = [];

  for (const row of pendingRows) {
    if (!isAssetId(row.assetId)) continue;
    if (row.side !== "BUY" && row.side !== "SELL") continue;
    const live = prices[row.assetId];
    if (live == null) continue;
    const working: WorkingOrder = {
      side: row.side,
      assetId: row.assetId,
      limitPrice: row.limitPrice,
      baseAmount: row.baseAmount,
      quoteReserved: row.quoteReserved,
      status: "PENDING",
    };
    const leg = fillTrade(working, new Prisma.Decimal(live));
    if (!leg) continue;

    const notice = await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: row.id, userId, status: "PENDING" },
        data: { status: "FILLED", filledAt: new Date() },
      });
      if (claimed.count !== 1) return null;
      const credit = fillCredit(working);
      await incrementBucket(tx, userId, credit.bucket, credit.amount);
      const trade = await tx.trade.create({
        data: {
          userId,
          type: leg.type,
          assetId: leg.assetId,
          // btcAmount stores the base quantity; assetId says which coin.
          btcAmount: leg.baseAmount,
          usdtAmount: leg.quoteAmount,
          priceAtTrade: leg.priceAtTrade,
        },
      });
      await tx.order.update({
        where: { id: row.id },
        data: { tradeId: trade.id },
      });
      return {
        id: row.id,
        message: formatFillToast(
          working.side,
          working.assetId,
          Number(working.baseAmount.toString()),
          Number(working.limitPrice.toString())
        ),
        side: working.side,
        assetId: working.assetId,
        baseAmount: Number(working.baseAmount.toString()),
        limitPrice: Number(working.limitPrice.toString()),
      } satisfies FillNotice;
    });
    if (notice) filled.push(notice);
  }

  if (filled.length > 0) revalidateTrading();

  const still = await prisma.order.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: PENDING_ORDER_LIMIT,
  });
  return {
    ok: true,
    filled,
    pending: still.flatMap((order) => {
      const view = viewFromRow(order);
      return view ? [view] : [];
    }),
  };
}
