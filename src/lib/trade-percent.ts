export type SpendAsset = "USDT" | "BTC";

// 100% of BTC keeps the wallet's stored precision. A rounded product can
// leave a remainder the sell path then rejects as insufficient balance.
export function percentPayAmount(
  balance: number,
  percent: number,
  asset: SpendAsset,
): number {
  if (asset === "BTC" && percent === 100) {
    return parseFloat(balance.toFixed(8));
  }
  const digits = asset === "USDT" ? 2 : 8;
  return parseFloat((balance * (percent / 100)).toFixed(digits));
}
