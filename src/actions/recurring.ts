"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { runDueRecurringPlans } from "@/lib/recurring-run";
import {
  advanceNextRun,
  planActiveMessage,
  RECURRING_ASSETS,
  RECURRING_CADENCES,
  type RecurringAssetId,
  type RecurringCadence,
} from "@/lib/recurring";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateSchema = z.object({
  assetId: z.enum(RECURRING_ASSETS),
  quoteAmount: z.number().positive().max(1_000_000),
  cadence: z.enum(RECURRING_CADENCES),
});

function refreshPlans() {
  revalidatePath("/dashboard");
  revalidatePath("/profile");
}

async function userId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function createRecurringPlan(input: {
  assetId: RecurringAssetId;
  quoteAmount: number;
  cadence: RecurringCadence;
}) {
  const id = await userId();
  if (!id) return { ok: false as const, error: "Not authenticated" };

  const parsed = CreateSchema.safeParse({
    ...input,
    quoteAmount: Math.round(input.quoteAmount * 100) / 100,
  });
  if (!parsed.success) return { ok: false as const, error: "Invalid plan" };

  const now = new Date();
  await prisma.recurringPlan.create({
    data: {
      userId: id,
      assetId: parsed.data.assetId,
      quoteAmount: new Prisma.Decimal(parsed.data.quoteAmount),
      cadence: parsed.data.cadence,
      status: "ACTIVE",
      nextRunAt: advanceNextRun(now, parsed.data.cadence),
    },
  });
  refreshPlans();
  return {
    ok: true as const,
    message: planActiveMessage(parsed.data),
  };
}

async function setStatus(
  planId: string,
  from: "ACTIVE" | "PAUSED",
  to: "ACTIVE" | "PAUSED" | "CANCELED",
) {
  const id = await userId();
  if (!id) return { ok: false as const, error: "Not authenticated" };
  const updated = await prisma.recurringPlan.updateMany({
    where: { id: planId, userId: id, status: from },
    data: { status: to },
  });
  if (updated.count !== 1) {
    return { ok: false as const, error: "Plan not found" };
  }
  refreshPlans();
  return { ok: true as const };
}

export async function pauseRecurringPlan(planId: string) {
  return setStatus(planId, "ACTIVE", "PAUSED");
}

export async function resumeRecurringPlan(planId: string) {
  return setStatus(planId, "PAUSED", "ACTIVE");
}

export async function cancelRecurringPlan(planId: string) {
  const id = await userId();
  if (!id) return { ok: false as const, error: "Not authenticated" };
  const updated = await prisma.recurringPlan.updateMany({
    where: {
      id: planId,
      userId: id,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
    data: { status: "CANCELED" },
  });
  if (updated.count !== 1) {
    return { ok: false as const, error: "Plan not found" };
  }
  refreshPlans();
  return { ok: true as const };
}

export async function tickRecurringPlans() {
  const id = await userId();
  if (!id) {
    return { fills: [] as string[], toastId: null, changed: false };
  }
  const tick = await runDueRecurringPlans(id);
  if (tick.changed) refreshPlans();
  return {
    fills: tick.fills,
    toastId: tick.fills.length > 0 ? crypto.randomUUID() : null,
    changed: tick.changed,
  };
}
