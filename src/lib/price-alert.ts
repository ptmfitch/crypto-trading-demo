export const BITCOIN_ASSET_ID = "bitcoin";
export const MAX_ACTIVE_ALERTS = 20;

export type AlertDirection = "ABOVE" | "BELOW";

export type ActivePriceAlert = {
  id: string;
  direction: AlertDirection;
  thresholdUsd: number;
};

export function isAlertDirection(value: string): value is AlertDirection {
  return value === "ABOVE" || value === "BELOW";
}

export function createPriceAlertError(
  input: { assetId: string; direction: string; thresholdUsd: number },
  activeCount: number
): string | null {
  if (input.assetId !== BITCOIN_ASSET_ID) {
    return "Only Bitcoin alerts are available.";
  }
  if (!isAlertDirection(input.direction)) return "Invalid direction.";
  if (!Number.isFinite(input.thresholdUsd) || input.thresholdUsd <= 0) {
    return "Enter a threshold above 0.";
  }
  if (activeCount >= MAX_ACTIVE_ALERTS) {
    return "You can have at most 20 active alerts.";
  }
  return null;
}

export function isPriceAlertDue(
  direction: AlertDirection,
  thresholdUsd: number,
  priceUsd: number
): boolean {
  if (!Number.isFinite(priceUsd) || !Number.isFinite(thresholdUsd)) return false;
  switch (direction) {
    case "ABOVE":
      return priceUsd >= thresholdUsd;
    case "BELOW":
      return priceUsd <= thresholdUsd;
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

export function duePriceAlerts<
  T extends { assetId: string; direction: string; thresholdUsd: number },
>(alerts: T[], priceUsd: number): Array<T & { direction: AlertDirection }> {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return [];
  const due: Array<T & { direction: AlertDirection }> = [];
  for (const alert of alerts) {
    if (alert.assetId !== BITCOIN_ASSET_ID) continue;
    if (!isAlertDirection(alert.direction)) continue;
    if (!isPriceAlertDue(alert.direction, alert.thresholdUsd, priceUsd)) continue;
    due.push({ ...alert, direction: alert.direction });
  }
  return due;
}

export function formatAlertUsd(amount: number): string {
  const cents = Math.round(amount * 100);
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function directionWord(direction: AlertDirection, casing: "lower" | "title"): string {
  switch (direction) {
    case "ABOVE":
      return casing === "lower" ? "above" : "Above";
    case "BELOW":
      return casing === "lower" ? "below" : "Below";
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

export function priceAlertRowLabel(
  direction: AlertDirection,
  thresholdUsd: number
): string {
  return `BTC · ${directionWord(direction, "title")} $${formatAlertUsd(thresholdUsd)}`;
}

export function priceAlertCrossedMessage(
  direction: AlertDirection,
  thresholdUsd: number
): string {
  return `BTC crossed $${formatAlertUsd(thresholdUsd)} (${directionWord(direction, "lower")})`;
}
