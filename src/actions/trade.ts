"use server";

import { auth } from "@/auth";
import { ASSETS, assetIdSchema, QUOTE_SYMBOL } from "@/lib/assets";
import { assertTradableQuote } from "@/lib/btc-quote";
import { getMarketQuotes } from "@/lib/btc-market";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TradeSchema = z.object({
  amount: z.number().positive(),
  side: z.enum(["BUY", "SELL"]),
  assetId: assetIdSchema,
});

function verb(side: "BUY" | "SELL") {
  switch (side) {
    case "BUY":
      return "bought";
    case "SELL":
      return "sold";
    default: {
      const exhaustive: never = side;
      return exhaustive;
    }
  }
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

  const { amount, side, assetId } = validatedFields.data;
  const asset = ASSETS[assetId];

  const tradable = assertTradableQuote((await getMarketQuotes())[assetId]);
  if (!tradable.ok) {
    return { error: tradable.error };
  }
  const price = new Prisma.Decimal(tradable.usd);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found.");

      let baseAmount: Prisma.Decimal;
      let quoteAmount: Prisma.Decimal;
      if (side === "BUY") {
        quoteAmount = new Prisma.Decimal(amount);
        baseAmount = quoteAmount.div(price);
      } else {
        baseAmount = new Prisma.Decimal(amount);
        quoteAmount = baseAmount.mul(price);
      }

      if (side === "BUY") {
        if (wallet.usdtBalance.lt(quoteAmount)) {
          throw new Error(`Insufficient ${QUOTE_SYMBOL} balance.`);
        }
        await tx.wallet.update({
          where: { userId },
          data: { usdtBalance: { decrement: quoteAmount } },
        });
        await tx.holding.upsert({
          where: { userId_assetId: { userId, assetId } },
          create: { userId, assetId, amount: baseAmount },
          update: { amount: { increment: baseAmount } },
        });
      } else {
        const holding = await tx.holding.findUnique({
          where: { userId_assetId: { userId, assetId } },
        });
        const balance = holding?.amount ?? new Prisma.Decimal(0);
        if (balance.lt(baseAmount)) {
          throw new Error(`Insufficient ${asset.symbol} balance.`);
        }
        await tx.holding.update({
          where: { userId_assetId: { userId, assetId } },
          data: { amount: { decrement: baseAmount } },
        });
        await tx.wallet.update({
          where: { userId },
          data: { usdtBalance: { increment: quoteAmount } },
        });
      }

      await tx.trade.create({
        data: {
          userId,
          side,
          assetId,
          baseAmount,
          quoteAmount,
          priceAtTrade: price,
        },
      });

      return {
        message: `Successfully ${verb(side)} ${baseAmount.toDP(
          asset.decimals
        )} ${asset.symbol} for $${quoteAmount.toDP(2)}`,
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
