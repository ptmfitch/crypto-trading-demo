import { auth } from "@/auth";
import { StatCard } from "@/components/StatCard";
import { DEFAULT_LOCALE, isAppLocale } from "@/lib/locale";
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
import prisma from "@/lib/prisma";
import {
  formatTradeHistoryBtc,
  formatTradeHistoryTotal,
} from "@/lib/trade-history";
import { Trade } from "@prisma/client";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguagePicker } from "./_components/LanguagePicker";
import {
  PnlDataPoint,
  PortfolioPnlChart,
} from "./_components/PortfolioPnlChart";

const INITIAL_CAPITAL = 10000;

function calculatePnlHistory(trades: Trade[]): PnlDataPoint[] {
  if (!trades || trades.length === 0) {
    return [];
  }
  let currentUsdt = INITIAL_CAPITAL;
  let currentBtc = 0;
  const pnlHistory: PnlDataPoint[] = trades.map((trade) => {
    const usdtAmount = Number(trade.usdtAmount);
    const btcAmount = Number(trade.btcAmount);
    if (trade.type === "BUY") {
      currentUsdt -= usdtAmount;
      currentBtc += btcAmount;
    } else {
      currentUsdt += usdtAmount;
      currentBtc -= btcAmount;
    }
    const portfolioValue =
      currentUsdt + currentBtc * Number(trade.priceAtTrade);
    const pnl = portfolioValue - INITIAL_CAPITAL;
    return {
      date: trade.timestamp.toISOString(),
      pnl: parseFloat(pnl.toFixed(2)),
    };
  });
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
  const t = await getTranslations("Profile");
  const requestedLocale = await getLocale();
  const locale = isAppLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          <LanguagePicker locale={locale} />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {hasSufficientDataForChart ? (
              <PortfolioPnlChart data={pnlData} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{t("chartTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[250px]">
                  <p className="text-muted-foreground">{t("chartEmpty")}</p>
                </CardContent>
              </Card>
            )}
          </div>
          <div className="lg:col-span-1 space-y-6">
            <StatCard
              title={t("lifetimePnl")}
              value={`$${finalPnl.toLocaleString()}`}
              icon={finalPnl >= 0 ? TrendingUp : TrendingDown}
              color={pnlColor}
            />
            <Card>
              <CardHeader>
                <CardTitle>{t("metrics")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("winRate")}</span>{" "}
                  <span className="font-semibold">{winRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("totalTrades")}</span>{" "}
                  <span className="font-semibold">{trades.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-green-500">
                    {t("bestTrade")}
                  </span>{" "}
                  <span className="font-semibold text-green-500">
                    +${bestTradePnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-red-500">
                    {t("worstTrade")}
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
          <h2 className="text-2xl font-bold mb-4">{t("history")}</h2>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("price")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <p className="font-medium">{t("emptyTitle")}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("emptyBody")}
                        </p>
                        <Link
                          href="/dashboard"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {t("emptyLink")}
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  [...trades].reverse().map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        {trade.timestamp.toLocaleString(locale)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            trade.type === "BUY" ? "default" : "destructive"
                          }
                        >
                          {trade.type === "BUY" ? t("buy") : t("sell")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        ${Number(trade.priceAtTrade).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {formatTradeHistoryBtc(trade.btcAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTradeHistoryTotal(trade.usdtAmount)}
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
