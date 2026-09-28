"use server";

import { auth } from "@/auth";
import { applyTrade } from "@/lib/apply-trade";
import { assertTradableQuote } from "@/lib/btc-quote";
import { getBtcQuote } from "@/lib/btc-market";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TradeSchema = z.object({
  amount: z.number().positive(),
  tradeType: z.enum(["BUY", "SELL"]),
  asset: z.enum(["USDT", "BTC"]),
});

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

  const tradable = assertTradableQuote(await getBtcQuote());
  if (!tradable.ok) {
    return { error: tradable.error };
  }
  const liveBtcPrice = new Prisma.Decimal(tradable.usd);

  try {
    const result = await applyTrade({
      userId,
      amount,
      tradeType,
      asset,
      price: liveBtcPrice,
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
