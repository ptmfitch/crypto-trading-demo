export type PnlPoint = {
  pnl: number;
};

export type AdvancedStats = {
  // Null when there is no history. 0% would look like a losing record.
  winRate: number | null;
  bestTradePnl: number;
  worstTradePnl: number;
};

export function calculateAdvancedStats(
  tradeCount: number,
  pnlData: PnlPoint[],
): AdvancedStats {
  if (tradeCount < 2) {
    return {
      winRate: tradeCount === 0 ? null : 0,
      bestTradePnl: 0,
      worstTradePnl: 0,
    };
  }

  let wins = 0;
  let bestTradePnl = 0;
  let worstTradePnl = 0;
  for (let i = 0; i < pnlData.length; i++) {
    const pnlChange =
      i === 0 ? pnlData[i].pnl : pnlData[i].pnl - pnlData[i - 1].pnl;
    if (pnlChange > 0) wins++;
    if (pnlChange > bestTradePnl) bestTradePnl = pnlChange;
    if (pnlChange < worstTradePnl) worstTradePnl = pnlChange;
  }

  const winRate = (wins / tradeCount) * 100;
  return { winRate, bestTradePnl, worstTradePnl };
}

export function formatWinRate(winRate: number | null): string {
  if (winRate == null) return "N/A";
  return `${winRate.toFixed(1)}%`;
}
