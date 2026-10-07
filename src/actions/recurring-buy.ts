"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { normalizeUsdtAmount, parseCadence } from "@/lib/recurring-buy";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RecurringBuySchema = z.object({
  amount: z.number(),
  cadence: z.string(),
});

export async function saveRecurringBuy(values: {
  amount: number;
  cadence: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const parsed = RecurringBuySchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const amount = normalizeUsdtAmount(parsed.data.amount);
  const cadence = parseCadence(parsed.data.cadence);
  if (amount == null || cadence == null) {
    return { error: "Enter a dollar amount and choose daily or weekly." };
  }

  const userId = session.user.id;
  const existing = await prisma.recurringBuy.findUnique({ where: { userId } });
  if (!existing) {
    await prisma.recurringBuy.create({
      data: {
        userId,
        usdtAmount: new Prisma.Decimal(amount),
        cadence,
        nextRunAt: new Date(),
      },
    });
  } else {
    await prisma.recurringBuy.update({
      where: { userId },
      data: {
        usdtAmount: new Prisma.Decimal(amount),
        cadence,
      },
    });
  }

  revalidatePath("/dashboard");
  return { success: "Recurring buy saved." };
}
