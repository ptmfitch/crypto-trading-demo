export const CADENCES = ["daily", "weekly"] as const;

export type Cadence = (typeof CADENCES)[number];

export const RECURRING_SKIP_NOTICE =
  "Recurring buy skipped until a live quote returns.";

export const RECURRING_FILLED_NOTICE = "Recurring buy filled.";

const DAY_MS = 86_400_000;

export type RecurringPlanSnapshot = {
  usdtAmount: number;
  cadence: Cadence;
  nextRunAt: Date;
};

export type RecurringOutcome = "none" | "wait" | "skip" | "ran" | "failed";

export type RecurringBuyView = {
  nextBuyLabel: string;
  savedAmount: number | null;
  savedCadence: Cadence;
  notice: string | null;
};

export function parseCadence(value: string): Cadence | null {
  return value === "daily" || value === "weekly" ? value : null;
}

export function normalizeUsdtAmount(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100) / 100;
  if (cents <= 0 || cents > 1_000_000) return null;
  return cents;
}

export function cadenceIntervalMs(cadence: Cadence): number {
  return cadence === "daily" ? DAY_MS : 7 * DAY_MS;
}

// One open fills one buy. The next run is one cadence after that fill,
// so a late visit does not replay the intervals that were missed.
export function nextRecurringRunAt(executedAt: Date, cadence: Cadence): Date {
  return new Date(executedAt.getTime() + cadenceIntervalMs(cadence));
}

export function decideRecurringBuy(input: {
  hasPlan: boolean;
  nextRunAt: Date | null;
  now: Date;
  tradable: boolean;
}): "none" | "wait" | "skip" | "run" {
  if (!input.hasPlan || input.nextRunAt == null) return "none";
  if (input.nextRunAt.getTime() > input.now.getTime()) return "wait";
  if (!input.tradable) return "skip";
  return "run";
}

export function formatNextBuy(
  plan: RecurringPlanSnapshot | null,
  now: Date
): string {
  if (!plan) return "Next buy: none";
  const amount = plan.usdtAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (plan.nextRunAt.getTime() <= now.getTime()) {
    return `Next buy: $${amount} ${plan.cadence} · due now`;
  }
  const when = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(plan.nextRunAt);
  return `Next buy: $${amount} ${plan.cadence} · ${when}`;
}

export function recurringBuyView(input: {
  plan: RecurringPlanSnapshot | null;
  outcome: RecurringOutcome;
  error?: string;
  now: Date;
}): RecurringBuyView {
  if (!input.plan || input.outcome === "none") {
    return {
      nextBuyLabel: "Next buy: none",
      savedAmount: null,
      savedCadence: "daily",
      notice:
        input.outcome === "failed" ? (input.error ?? "Trade failed.") : null,
    };
  }

  let notice: string | null = null;
  if (input.outcome === "skip") notice = RECURRING_SKIP_NOTICE;
  if (input.outcome === "ran") notice = RECURRING_FILLED_NOTICE;
  if (input.outcome === "failed") notice = input.error ?? "Trade failed.";

  return {
    nextBuyLabel: formatNextBuy(input.plan, input.now),
    savedAmount: input.plan.usdtAmount,
    savedCadence: input.plan.cadence,
    notice,
  };
}
