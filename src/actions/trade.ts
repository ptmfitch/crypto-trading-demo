"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TradeSchema = z.object({
  amount: z.number().positive(),
  tradeType: z.enum(["BUY", "SELL"]),
  asset: z.enum(["USDT", "BTC"]),
});

function tradeSuccessMessage(
  tradeType: "BUY" | "SELL",
  btcDisplay: Prisma.Decimal,
  usdtDisplay: Prisma.Decimal
) {
  switch (tradeType) {
    case "BUY":
      return `Bought ≈ ${btcDisplay} BTC with $${usdtDisplay}`;
    case "SELL":
      return `Sold ≈ ${btcDisplay} BTC for $${usdtDisplay}`;
    default: {
      const unreachable: never = tradeType;
      throw new Error(unreachable);
    }
  }
}

async function getLiveBtcPrice() {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    { cache: "no-store" }
  );
  const data = await response.json();
  if (!data?.bitcoin?.usd || typeof data.bitcoin.usd !== "number") {
    throw new Error(
      "Failed to fetch a valid BTC price. Please try again later."
    );
  }
  return new Prisma.Decimal(data.bitcoin.usd);
}

export async function executeTrade(values: z.infer<typeof TradeSchema>) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }
  const userId = session.user.id;

  const validatedFields = TradeSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid input" };
  }

  const { amount, tradeType, asset } = validatedFields.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const liveBtcPrice = await getLiveBtcPrice();
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found.");

      let usdtAmount: Prisma.Decimal;
      let btcAmount: Prisma.Decimal;

      if (asset === "USDT") {
        usdtAmount = new Prisma.Decimal(amount);
        btcAmount = usdtAmount.div(liveBtcPrice);
      } else {
        btcAmount = new Prisma.Decimal(amount);
        usdtAmount = btcAmount.mul(liveBtcPrice);
      }

      if (tradeType === "BUY") {
        if (wallet.usdtBalance.lt(usdtAmount))
          throw new Error("Insufficient USDT balance.");
        await tx.wallet.update({
          where: { userId },
          data: {
            usdtBalance: { decrement: usdtAmount },
            btcBalance: { increment: btcAmount },
          },
        });
      } else {
        if (wallet.btcBalance.lt(btcAmount))
          throw new Error("Insufficient BTC balance.");
        await tx.wallet.update({
          where: { userId },
          data: {
            usdtBalance: { increment: usdtAmount },
            btcBalance: { decrement: btcAmount },
          },
        });
      }

      await tx.trade.create({
        data: {
          userId,
          type: tradeType,
          usdtAmount: usdtAmount,
          btcAmount: btcAmount,
          priceAtTrade: liveBtcPrice,
        },
      });

      const btcDisplay = btcAmount.toDP(6);
      const usdtDisplay = usdtAmount.toDP(2);

      return {
        message: tradeSuccessMessage(tradeType, btcDisplay, usdtDisplay),
      };
    });

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    return { success: result.message };
  } catch (error) {
    let message = "Trade failed.";
    if (error instanceof Error && error.message) {
      message = error.message;
    }
    return { error: message };
  }
}
