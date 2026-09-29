"use server";

import { auth } from "@/auth";
import { getBtcQuote } from "@/lib/btc-market";
import {
  BITCOIN_ASSET_ID,
  createPriceAlertError,
  duePriceAlerts,
  isAlertDirection,
  priceAlertCrossedMessage,
  type ActivePriceAlert,
  type AlertDirection,
} from "@/lib/price-alert";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

function revalidateAlerts() {
  revalidatePath("/dashboard");
  revalidatePath("/profile");
}

export async function listActivePriceAlerts(): Promise<ActivePriceAlert[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rows = await prisma.priceAlert.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  const alerts: ActivePriceAlert[] = [];
  for (const row of rows) {
    if (!isAlertDirection(row.direction)) continue;
    alerts.push({
      id: row.id,
      direction: row.direction,
      thresholdUsd: Number(row.thresholdUsd),
    });
  }
  return alerts;
}

export async function createPriceAlert(input: {
  assetId: string;
  direction: string;
  thresholdUsd: number;
}): Promise<{ error: string } | { success: true }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const activeCount = await prisma.priceAlert.count({
    where: { userId: session.user.id, status: "ACTIVE" },
  });
  const error = createPriceAlertError(input, activeCount);
  if (error) return { error };

  await prisma.priceAlert.create({
    data: {
      userId: session.user.id,
      assetId: BITCOIN_ASSET_ID,
      direction: input.direction as AlertDirection,
      thresholdUsd: new Prisma.Decimal(input.thresholdUsd),
      status: "ACTIVE",
    },
  });
  revalidateAlerts();
  return { success: true };
}

export async function cancelPriceAlert(
  id: string
): Promise<{ error: string } | { success: true }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const updated = await prisma.priceAlert.updateMany({
    where: { id, userId: session.user.id, status: "ACTIVE" },
    data: { status: "CANCELED" },
  });
  if (updated.count !== 1) return { error: "Alert is no longer active." };
  revalidateAlerts();
  return { success: true };
}

export async function tickPriceAlerts(): Promise<{
  fired: { id: string; message: string }[];
}> {
  const session = await auth();
  if (!session?.user?.id) return { fired: [] };

  const rows = await prisma.priceAlert.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
  });
  if (rows.length === 0) return { fired: [] };

  // Fire from the shared quote whenever a price exists, including a delayed
  // cache. Already-past thresholds toast on this tick; there is no arming price.
  const quote = await getBtcQuote();
  if (quote.usd == null || !(quote.usd > 0)) return { fired: [] };

  const due = duePriceAlerts(
    rows.map((row) => ({
      id: row.id,
      assetId: row.assetId,
      direction: row.direction,
      thresholdUsd: Number(row.thresholdUsd),
    })),
    quote.usd
  );

  const triggeredAt = new Date();
  const fired: { id: string; message: string }[] = [];
  for (const alert of due) {
    // The tick that flips ACTIVE wins the toast. A second tick sees count 0.
    const updated = await prisma.priceAlert.updateMany({
      where: { id: alert.id, userId: session.user.id, status: "ACTIVE" },
      data: { status: "TRIGGERED", triggeredAt },
    });
    if (updated.count !== 1) continue;
    fired.push({
      id: alert.id,
      message: priceAlertCrossedMessage(alert.direction, alert.thresholdUsd),
    });
  }

  if (fired.length > 0) revalidateAlerts();
  return { fired };
}
