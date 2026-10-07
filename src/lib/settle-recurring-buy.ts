import {
  assertTradableQuote,
  TRADE_PAUSED_ERROR,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import { performTrade } from "@/lib/perform-trade";
import prisma from "@/lib/prisma";
import {
  decideRecurringBuy,
  nextRecurringRunAt,
  normalizeUsdtAmount,
  parseCadence,
  type RecurringBuyView,
  recurringBuyView,
} from "@/lib/recurring-buy";

export async function settleDueRecurringBuy(
  userId: string,
  quote: { status: BtcQuoteStatus; usd: number | null }
): Promise<RecurringBuyView> {
  const now = new Date();
  const row = await prisma.recurringBuy.findUnique({ where: { userId } });
  if (!row) {
    return recurringBuyView({ plan: null, outcome: "none", now });
  }

  const amount = normalizeUsdtAmount(Number(row.usdtAmount));
  const cadence = parseCadence(row.cadence);
  if (amount == null || cadence == null) {
    return recurringBuyView({
      plan: null,
      outcome: "failed",
      error: "Invalid input",
      now,
    });
  }

  const plan = {
    usdtAmount: amount,
    cadence,
    nextRunAt: row.nextRunAt,
  };
  const decision = decideRecurringBuy({
    hasPlan: true,
    nextRunAt: plan.nextRunAt,
    now,
    tradable: assertTradableQuote(quote).ok,
  });
  if (decision !== "run") {
    return recurringBuyView({ plan, outcome: decision, now });
  }

  const nextRunAt = nextRecurringRunAt(now, cadence);
  // Claim the due row before the trade so a second dashboard render cannot
  // fill the same buy. A failed trade puts the due time back.
  const claimed = await prisma.recurringBuy.updateMany({
    where: { id: row.id, nextRunAt: { lte: now } },
    data: { nextRunAt },
  });
  if (claimed.count !== 1) {
    const current = await prisma.recurringBuy.findUnique({ where: { userId } });
    const currentAmount = current
      ? normalizeUsdtAmount(Number(current.usdtAmount))
      : null;
    const currentCadence = current ? parseCadence(current.cadence) : null;
    if (!current || currentAmount == null || currentCadence == null) {
      return recurringBuyView({ plan, outcome: "wait", now });
    }
    return recurringBuyView({
      plan: {
        usdtAmount: currentAmount,
        cadence: currentCadence,
        nextRunAt: current.nextRunAt,
      },
      outcome: "wait",
      now,
    });
  }

  const result = await performTrade(userId, {
    amount,
    tradeType: "BUY",
    asset: "USDT",
  });
  if ("error" in result) {
    await prisma.recurringBuy.updateMany({
      where: { id: row.id, nextRunAt },
      data: { nextRunAt: plan.nextRunAt },
    });
    if (result.error === TRADE_PAUSED_ERROR) {
      return recurringBuyView({ plan, outcome: "skip", now });
    }
    return recurringBuyView({
      plan,
      outcome: "failed",
      error: result.error,
      now,
    });
  }

  return recurringBuyView({
    plan: { ...plan, nextRunAt },
    outcome: "ran",
    now,
  });
}
