import { Prisma } from "@prisma/client";

import prisma from "./prisma";

export async function applyTrade(input: {
  userId: string;
  amount: number;
  tradeType: "BUY" | "SELL";
  asset: "USDT" | "BTC";
  price: Prisma.Decimal;
}) {
  const { userId, amount, tradeType, asset, price } = input;

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found.");

    let usdtAmount: Prisma.Decimal;
    let btcAmount: Prisma.Decimal;

    if (asset === "USDT") {
      usdtAmount = new Prisma.Decimal(amount);
      btcAmount = usdtAmount.div(price);
    } else if (asset === "BTC") {
      btcAmount = new Prisma.Decimal(amount);
      usdtAmount = btcAmount.mul(price);
    } else {
      const exhaustive: never = asset;
      throw new Error(`Unsupported asset: ${exhaustive}`);
    }

    if (tradeType === "BUY") {
      if (wallet.usdtBalance.lt(usdtAmount)) {
        throw new Error("Insufficient USDT balance.");
      }
      await tx.wallet.update({
        where: { userId },
        data: {
          usdtBalance: { decrement: usdtAmount },
          btcBalance: { increment: btcAmount },
        },
      });
    } else if (tradeType === "SELL") {
      if (wallet.btcBalance.lt(btcAmount)) {
        throw new Error("Insufficient BTC balance.");
      }
      await tx.wallet.update({
        where: { userId },
        data: {
          usdtBalance: { increment: usdtAmount },
          btcBalance: { decrement: btcAmount },
        },
      });
    } else {
      const exhaustive: never = tradeType;
      throw new Error(`Unsupported trade type: ${exhaustive}`);
    }

    await tx.trade.create({
      data: {
        userId,
        type: tradeType,
        usdtAmount,
        btcAmount,
        priceAtTrade: price,
      },
    });

    const btcDisplay = btcAmount.toDP(6);
    const usdtDisplay = usdtAmount.toDP(2);

    return {
      message: `Successfully ${
        tradeType === "BUY" ? "bought" : "sold"
      } ${btcDisplay} BTC for $${usdtDisplay}`,
    };
  });
}
