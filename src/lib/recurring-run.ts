import { settleUsdtBuy } from "@/lib/market-buy";
import { assertTradableQuote } from "@/lib/btc-quote";
import { getBtcQuote } from "@/lib/btc-market";
import prisma from "@/lib/prisma";
import {
  advanceNextRun,
  fillMessage,
  periodOutcome,
  type RecurringAssetId,
  type RecurringCadence,
} from "@/lib/recurring";
import { Prisma } from "@prisma/client";

type DuePlan = {
  id: string;
  userId: string;
  assetId: RecurringAssetId;
  quoteAmount: Prisma.Decimal;
  cadence: RecurringCadence;
  nextRunAt: Date;
};

export type RecurringTick = {
  fills: string[];
  changed: boolean;
};

async function claimPeriod(plan: DuePlan, advanced: Date): Promise<boolean> {
  const claimed = await prisma.recurringPlan.updateMany({
    where: { id: plan.id, status: "ACTIVE", nextRunAt: plan.nextRunAt },
    data: { nextRunAt: advanced },
  });
  return claimed.count === 1;
}

async function runPlan(
  plan: DuePlan,
  now: Date,
  price: Prisma.Decimal | null,
): Promise<{ fill: string | null; changed: boolean }> {
  // A missing BTC quote retries the same period. Affordability is checked later.
  if (
    periodOutcome({
      assetId: plan.assetId,
      quoteOk: price != null,
      affordable: true,
    }) === "retry"
  ) {
    return { fill: null, changed: false };
  }

  const advanced = advanceNextRun(plan.nextRunAt, plan.cadence);
  if (plan.assetId !== "bitcoin" || price == null) {
    const changed = await claimPeriod(plan, advanced);
    return { fill: null, changed };
  }

  const usdtAmount = new Prisma.Decimal(plan.quoteAmount);
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId: plan.userId },
    });
    if (!wallet) return { fill: null, changed: false };

    const outcome = periodOutcome({
      assetId: "bitcoin",
      quoteOk: true,
      affordable: wallet.usdtBalance.gte(usdtAmount),
    });
    if (outcome === "retry") return { fill: null, changed: false };

    const claimed = await tx.recurringPlan.updateMany({
      where: { id: plan.id, status: "ACTIVE", nextRunAt: plan.nextRunAt },
      data:
        outcome === "fill"
          ? { nextRunAt: advanced, lastRunAt: now }
          : { nextRunAt: advanced },
    });
    if (claimed.count !== 1) return { fill: null, changed: false };
    if (outcome !== "fill") return { fill: null, changed: true };

    const settled = await settleUsdtBuy(tx, plan.userId, usdtAmount, price);
    if (!settled.ok) {
      throw new Error("Recurring buy did not settle");
    }
    return {
      fill: fillMessage({
        assetId: "bitcoin",
        quoteAmount: Number(plan.quoteAmount),
      }),
      changed: true,
    };
  });
}

export async function runDueRecurringPlans(
  userId: string,
  now = new Date(),
): Promise<RecurringTick> {
  const due = await prisma.recurringPlan.findMany({
    where: { userId, status: "ACTIVE", nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
  });
  if (due.length === 0) return { fills: [], changed: false };

  let price: Prisma.Decimal | null = null;
  if (due.some((plan) => plan.assetId === "bitcoin")) {
    const tradable = assertTradableQuote(await getBtcQuote());
    if (tradable.ok) price = new Prisma.Decimal(tradable.usd);
  }

  const fills: string[] = [];
  let changed = false;
  for (const plan of due) {
    try {
      const result = await runPlan(plan, now, price);
      if (result.changed) changed = true;
      if (result.fill) fills.push(result.fill);
    } catch (error) {
      console.error("Recurring plan tick failed", plan.id, error);
    }
  }
  return { fills, changed };
}
