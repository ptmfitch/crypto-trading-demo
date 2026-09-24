import { Prisma } from "@prisma/client";

// Shared USDT market buy used by the trade form and the recurring executor.
export async function settleUsdtBuy(
  tx: Prisma.TransactionClient,
  userId: string,
  usdtAmount: Prisma.Decimal,
  liveBtcPrice: Prisma.Decimal,
): Promise<
  | { ok: true; btcAmount: Prisma.Decimal }
  | { ok: false; reason: "insufficient" | "wallet" }
> {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) return { ok: false, reason: "wallet" };
  if (wallet.usdtBalance.lt(usdtAmount)) {
    return { ok: false, reason: "insufficient" };
  }

  const btcAmount = usdtAmount.div(liveBtcPrice);
  await tx.wallet.update({
    where: { userId },
    data: {
      usdtBalance: { decrement: usdtAmount },
      btcBalance: { increment: btcAmount },
    },
  });
  await tx.trade.create({
    data: {
      userId,
      type: "BUY",
      usdtAmount,
      btcAmount,
      priceAtTrade: liveBtcPrice,
    },
  });
  return { ok: true, btcAmount };
}
