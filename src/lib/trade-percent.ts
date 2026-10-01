export type SpendAsset = "USDT" | "BTC";

// toFixed rounds half-up, so a 100% fill can exceed the wallet. Execution
// compares that amount to the unrounded balance and rejects the trade.
export function percentPayAmount(
  balance: number,
  percent: number,
  asset: SpendAsset,
): number {
  const digits = asset === "USDT" ? 2 : 8;
  const portion = balance * (percent / 100);
  const rounded = parseFloat(portion.toFixed(digits));
  if (rounded <= balance) return rounded;
  const factor = 10 ** digits;
  return Math.min(Math.floor(portion * factor) / factor, balance);
}
