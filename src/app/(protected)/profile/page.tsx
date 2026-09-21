import { auth } from "@/auth";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ASSETS, isAssetId } from "@/lib/assets";
import prisma from "@/lib/prisma";
import { Trade } from "@prisma/client";
import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PnlDataPoint,
  PortfolioPnlChart,
} from "./_components/PortfolioPnlChart";

const INITIAL_CAPITAL = 10000;

function applyTradeSide(
  side: string,
  cash: number,
  base: number,
  quote: number,
  held: number
): { cash: number; held: number } | null {
  switch (side) {
    case "BUY":
      return { cash: cash - quote, held: held + base };
    case "SELL":
      return { cash: cash + quote, held: held - base };
    default:
      return null;
  }
}

function calculatePnlHistory(trades: Trade[]): PnlDataPoint[] {
  if (!trades || trades.length === 0) {
    return [];
  }
  let cash = INITIAL_CAPITAL;
  const balances = new Map<string, number>();
  const marks = new Map<string, number>();
  const pnlHistory: PnlDataPoint[] = [];
  for (const trade of trades) {
    const next = applyTradeSide(
      trade.side,
      cash,
      Number(trade.baseAmount),
      Number(trade.quoteAmount),
      balances.get(trade.assetId) ?? 0
    );
    if (!next) continue;
    cash = next.cash;
    balances.set(trade.assetId, next.held);
    marks.set(trade.assetId, Number(trade.priceAtTrade));
    let portfolioValue = cash;
    for (const [assetId, amount] of balances) {
      portfolioValue += amount * (marks.get(assetId) ?? 0);
    }
    pnlHistory.push({
      date: trade.timestamp.toISOString(),
      pnl: parseFloat((portfolioValue - INITIAL_CAPITAL).toFixed(2)),
    });
  }
  return pnlHistory;
}

function calculateAdvancedStats(trades: Trade[], pnlData: PnlDataPoint[]) {
  if (trades.length < 2)
    return { winRate: 0, bestTradePnl: 0, worstTradePnl: 0 };
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
  const winRate = (wins / trades.length) * 10;
  return { winRate, bestTradePnl, worstTradePnl };
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id },
    orderBy: { timestamp: "asc" },
  });

  const pnlData = calculatePnlHistory(trades);
  const finalPnl = pnlData.length > 0 ? pnlData[pnlData.length - 1].pnl : 0;
  const pnlColor = finalPnl >= 0 ? "text-green-500" : "text-red-500";
  const hasSufficientDataForChart = pnlData && pnlData.length > 1;
  const { winRate, bestTradePnl, worstTradePnl } = calculateAdvancedStats(
    trades,
    pnlData
  );

  return (
    <main className="flex-1 bg-muted/40">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Performance Report</h1>
          <p className="text-muted-foreground">
            A detailed look at your trading history and performance.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {hasSufficientDataForChart ? (
              <PortfolioPnlChart data={pnlData} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Performance Chart</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[250px]">
                  <p className="text-muted-foreground">
                    Make at least two trades to see your performance chart.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <div className="lg:col-span-1 space-y-6">
            <StatCard
              title="Lifetime P&L"
              value={`$${finalPnl.toLocaleString()}`}
              icon={finalPnl >= 0 ? TrendingUp : TrendingDown}
              color={pnlColor}
            />
            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Win Rate</span>{" "}
                  <span className="font-semibold">{winRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Trades</span>{" "}
                  <span className="font-semibold">{trades.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-green-500">
                    Best Trade
                  </span>{" "}
                  <span className="font-semibold text-green-500">
                    +${bestTradePnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-red-500">
                    Worst Trade
                  </span>{" "}
                  <span className="font-semibold text-red-500">
                    -${Math.abs(worstTradePnl).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Trade History</h2>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Price (USDT)</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Total (USDT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <p className="font-medium">No trades yet</p>
                        <p className="text-sm text-muted-foreground">
                          Your buy and sell history will appear here after your
                          first order.
                        </p>
                        <Link
                          href="/dashboard"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Place your first trade
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  [...trades].reverse().map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>{trade.timestamp.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            trade.side === "BUY" ? "default" : "destructive"
                          }
                        >
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isAssetId(trade.assetId)
                          ? ASSETS[trade.assetId].symbol
                          : trade.assetId}
                      </TableCell>
                      <TableCell>
                        ${Number(trade.priceAtTrade).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {Number(trade.baseAmount).toFixed(
                          isAssetId(trade.assetId)
                            ? ASSETS[trade.assetId].decimals
                            : 8
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(trade.quoteAmount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </main>
  );
}
