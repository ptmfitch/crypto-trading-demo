import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { DollarSign, ListChecks, TrendingUp, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { StatCard } from "@/components/StatCard";
import { ASSET_IDS, isAssetId, type AssetId } from "@/lib/assets";
import { getMarketQuotes, type AssetQuote } from "@/lib/btc-market";
import { quoteDelayLabel, type BtcQuoteStatus } from "@/lib/btc-quote";
import { ensureHoldings } from "@/lib/holdings";
import { BtcPriceChart } from "./_components/BtcPriceChart";
import { TradeForm } from "./_components/TradeForm";

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function emptyHoldings(): Record<AssetId, number> {
  return Object.fromEntries(ASSET_IDS.map((id) => [id, 0])) as Record<
    AssetId,
    number
  >;
}

function portfolioValue(
  usdt: number,
  holdings: Record<AssetId, number>,
  quotes: Record<AssetId, AssetQuote>
) {
  let total = usdt;
  let usedStale = false;
  for (const id of ASSET_IDS) {
    if (holdings[id] === 0) continue;
    const quote = quotes[id];
    if (quote.usd == null) return { total: null, usedStale };
    if (quote.status === "stale") usedStale = true;
    total += holdings[id] * quote.usd;
  }
  return { total, usedStale };
}

async function getDashboardData(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    console.error("Dashboard Error: Wallet not found for user:", userId);
    return null;
  }

  await ensureHoldings(userId);
  const [tradeCount, quotes, holdingRows] = await Promise.all([
    prisma.trade.count({ where: { userId } }),
    getMarketQuotes(),
    prisma.holding.findMany({ where: { userId } }),
  ]);

  const holdings = emptyHoldings();
  for (const row of holdingRows) {
    if (isAssetId(row.assetId)) holdings[row.assetId] = Number(row.amount);
  }

  const usdt = Number(wallet.usdtBalance);
  const { total, usedStale } = portfolioValue(usdt, holdings, quotes);
  const pnl = total == null ? null : total - 10000;

  return { wallet, holdings, tradeCount, quotes, totalValue: total, pnl, usedStale };
}

function priceStat(status: BtcQuoteStatus, usd: number | null) {
  switch (status) {
    case "fresh":
      return {
        value: usd == null ? "—" : formatUsd(usd),
        description: undefined,
        color: undefined,
      };
    case "stale":
      return {
        value: usd == null ? "—" : formatUsd(usd),
        description: quoteDelayLabel(status) ?? undefined,
        color: "text-muted-foreground",
      };
    case "unavailable":
      return {
        value: "—",
        description: quoteDelayLabel(status) ?? undefined,
        color: "text-muted-foreground",
      };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getDashboardData(session.user.id);
  if (!data) {
    return (
      <main className="flex-1 bg-muted/40">
        <div className="container mx-auto py-8 text-center">
          <h2 className="text-xl font-semibold text-destructive">
            Could Not Load Dashboard
          </h2>
          <p className="text-muted-foreground">
            There was a problem loading your wallet. Please try refreshing the
            page.
          </p>
        </div>
      </main>
    );
  }

  const { wallet, holdings, quotes, totalValue, pnl, tradeCount, usedStale } =
    data;
  const bitcoin = quotes.bitcoin;
  const pnlColor =
    pnl == null ? "text-muted-foreground" : pnl >= 0 ? "text-green-500" : "text-red-500";
  const price = priceStat(bitcoin.status, bitcoin.usd);
  const portfolioDescription = usedStale
    ? "Includes a delayed quote"
    : totalValue == null
      ? "Coin value unavailable"
      : undefined;

  return (
    <main className="flex-1 bg-muted/40">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            Welcome Back, {session.user.name || "Trader"}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s your trading dashboard overview.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            title="Portfolio Value"
            value={totalValue == null ? "—" : formatUsd(totalValue)}
            icon={Wallet}
            description={portfolioDescription}
          />
          <StatCard
            title="Total P&L"
            value={
              pnl == null
                ? "—"
                : `${pnl >= 0 ? "+" : ""}${formatUsd(pnl)}`
            }
            icon={TrendingUp}
            color={pnlColor}
            href="/profile"
            description={usedStale ? "Includes a delayed quote" : undefined}
          />
          <StatCard
            title="Live BTC Price"
            value={price.value}
            icon={DollarSign}
            color={price.color}
            description={price.description}
          />
          <StatCard
            title="Total Trades"
            value={tradeCount.toString()}
            icon={ListChecks}
            href="/profile"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BtcPriceChart />
          </div>

          <div className="lg:col-span-1">
            <TradeForm
              initialQuotes={{
                bitcoin: {
                  usd: quotes.bitcoin.usd,
                  usd24hChange: quotes.bitcoin.usd24hChange,
                  status: quotes.bitcoin.status,
                },
                ethereum: {
                  usd: quotes.ethereum.usd,
                  usd24hChange: quotes.ethereum.usd24hChange,
                  status: quotes.ethereum.status,
                },
                solana: {
                  usd: quotes.solana.usd,
                  usd24hChange: quotes.solana.usd24hChange,
                  status: quotes.solana.status,
                },
              }}
              usdtBalance={Number(wallet.usdtBalance)}
              holdings={holdings}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
