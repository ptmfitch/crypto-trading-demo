"use server";

import { auth } from "@/auth";
import { performTrade, type TradeInput } from "@/lib/perform-trade";
import { revalidatePath } from "next/cache";

export async function executeTrade(values: TradeInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const result = await performTrade(session.user.id, values);
  if ("success" in result) {
    revalidatePath("/dashboard");
    revalidatePath("/profile");
  }
  return result;
}
