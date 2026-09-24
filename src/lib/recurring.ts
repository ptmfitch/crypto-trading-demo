export const RECURRING_ASSETS = ["bitcoin", "ethereum", "solana"] as const;
export type RecurringAssetId = (typeof RECURRING_ASSETS)[number];

export const RECURRING_CADENCES = ["DAILY", "WEEKLY"] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export const ASSET_SYMBOL: Record<RecurringAssetId, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
};

export const ASSET_NAME: Record<RecurringAssetId, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
};

const DAY_MS = 86_400_000;

export type PeriodOutcome = "fill" | "skip" | "retry";

export type RecurringPlanView = {
  id: string;
  assetId: RecurringAssetId;
  quoteAmount: number;
  cadence: RecurringCadence;
  status: "ACTIVE" | "PAUSED";
  nextRunAt: string;
  lastRunAt: string | null;
};

export function cadenceLabel(cadence: RecurringCadence): string {
  switch (cadence) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return "Weekly";
    default: {
      const exhaustive: never = cadence;
      return exhaustive;
    }
  }
}

function cadenceDays(cadence: RecurringCadence): number {
  switch (cadence) {
    case "DAILY":
      return 1;
    case "WEEKLY":
      return 7;
    default: {
      const exhaustive: never = cadence;
      return exhaustive;
    }
  }
}

export function advanceNextRun(from: Date, cadence: RecurringCadence): Date {
  return new Date(from.getTime() + cadenceDays(cadence) * DAY_MS);
}

export function formatPlanAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

export function planTitle(plan: {
  assetId: RecurringAssetId;
  quoteAmount: number;
  cadence: RecurringCadence;
}): string {
  return `${ASSET_SYMBOL[plan.assetId]} · ${formatPlanAmount(plan.quoteAmount)} · ${cadenceLabel(plan.cadence)}`;
}

export function planActiveMessage(plan: {
  assetId: RecurringAssetId;
  quoteAmount: number;
  cadence: RecurringCadence;
}): string {
  return `${cadenceLabel(plan.cadence)} ${formatPlanAmount(plan.quoteAmount)} ${ASSET_SYMBOL[plan.assetId]} plan active`;
}

export function fillMessage(plan: {
  assetId: RecurringAssetId;
  quoteAmount: number;
}): string {
  return `Recurring buy filled · ${formatPlanAmount(plan.quoteAmount)} ${ASSET_SYMBOL[plan.assetId]}`;
}

export function formatNextRunLabel(date: Date): string {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${weekdays[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

export function pausedDetail(lastRunAt: Date | null, now: Date): string {
  if (!lastRunAt) return "Paused";
  const days = Math.floor((now.getTime() - lastRunAt.getTime()) / DAY_MS);
  if (days <= 0) return "Paused · last fill today";
  return `Paused · last fill ${days}d ago`;
}

// BTC settles through the paper wallet. ETH and SOL have no balance column,
// so those periods are skipped instead of buying BTC by mistake.
export function periodOutcome(input: {
  assetId: RecurringAssetId;
  quoteOk: boolean;
  affordable: boolean;
}): PeriodOutcome {
  switch (input.assetId) {
    case "bitcoin":
      if (!input.quoteOk) return "retry";
      return input.affordable ? "fill" : "skip";
    case "ethereum":
    case "solana":
      return "skip";
    default: {
      const exhaustive: never = input.assetId;
      return exhaustive;
    }
  }
}
