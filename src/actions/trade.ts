"use server";

import { auth } from "@/auth";
import { assertTradableQuote } from "@/lib/btc-quote";
import { getBtcQuote } from "@/lib/btc-market";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TradeSchema = z.object({
  amount: z.number().positive(),
  tradeType: z.enum(["BUY", "SELL"]),
  asset: z.enum(["USDT", "BTC"]),
});

export async function executeTrade(values: z.infer<typeof TradeSchema>) {
  const t = await getTranslations("Trade");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("notAuthenticated") };
  }
  const userId = session.user.id;

  const validatedFields = TradeSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: t("invalidInput") };
  }

  const { amount, tradeType, asset } = validatedFields.data;

  const tradable = assertTradableQuote(await getBtcQuote());
  if (!tradable.ok) {
    return { error: t("paused") };
  }
  const liveBtcPrice = new Prisma.Decimal(tradable.usd);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("walletMissing");

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
          throw new Error("insufficientUsdt");
        await tx.wallet.update({
          where: { userId },
          data: {
            usdtBalance: { decrement: usdtAmount },
            btcBalance: { increment: btcAmount },
          },
        });
      } else {
        if (wallet.btcBalance.lt(btcAmount))
          throw new Error("insufficientBtc");
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
        btc: btcDisplay.toString(),
        usdt: usdtDisplay.toString(),
      };
    });

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    return {
      success: t(tradeType === "BUY" ? "bought" : "sold", result),
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (
      code === "walletMissing" ||
      code === "insufficientUsdt" ||
      code === "insufficientBtc"
    ) {
      return { error: t(code) };
    }
    return { error: t("failed") };
  }
}
