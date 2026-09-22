import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { DollarSign, ListChecks, TrendingUp, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { StatCard } from "@/components/StatCard";
import { toOrderView, type AssetId } from "@/lib/assets";
import { getAssetPrices, getBtcQuote } from "@/lib/btc-market";
import { quoteDelayLabel, type BtcQuoteStatus } from "@/lib/btc-quote";
import { BtcPriceChart } from "./_components/BtcPriceChart";
import { TradeForm } from "./_components/TradeForm";

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function markedValue(qty: number, price: number | null | undefined) {
  if (qty === 0) return 0;
  if (price == null) return null;
  return qty * price;
}

async function getDashboardData(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    console.error("Dashboard Error: Wallet not found for user:", userId);
    return null;
  }

  const usdt = Number(wallet.usdtBalance);
  const btc = Number(wallet.btcBalance);
  const eth = Number(wallet.ethBalance);
  const sol = Number(wallet.solBalance);
  const [tradeCount, quote, pendingRows, altPrices] = await Promise.all([
    prisma.trade.count({ where: { userId } }),
    getBtcQuote(),
    prisma.order.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    eth > 0 || sol > 0
      ? getAssetPrices(["ethereum", "solana"])
      : Promise.resolve({} as Partial<Record<AssetId, number>>),
  ]);

  const btcValue = markedValue(btc, quote.usd);
  const ethValue = markedValue(eth, altPrices.ethereum);
  const solValue = markedValue(sol, altPrices.solana);
  const totalValue =
    btcValue == null || ethValue == null || solValue == null
      ? null
      : usdt + btcValue + ethValue + solValue;
  const pnl = totalValue == null ? null : totalValue - 10000;
  const pendingOrders = pendingRows.flatMap((order) => {
    const view = toOrderView({
      id: order.id,
      side: order.side,
      assetId: order.assetId,
      limitPrice: Number(order.limitPrice),
      baseAmount: Number(order.baseAmount),
      quoteReserved: Number(order.quoteReserved),
    });
    return view ? [view] : [];
  });

  return { wallet, tradeCount, quote, totalValue, pnl, eth, sol, pendingOrders };
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

  const { wallet, quote, totalValue, pnl, tradeCount, eth, sol, pendingOrders } = data;
  const pnlColor =
    pnl == null ? "text-muted-foreground" : pnl >= 0 ? "text-green-500" : "text-red-500";
  const price = priceStat(quote.status, quote.usd);
  const portfolioDescription =
    quote.status === "stale"
      ? "Includes a delayed BTC quote"
      : totalValue == null && quote.status === "unavailable" && eth === 0 && sol === 0
        ? "BTC value unavailable"
        : totalValue == null
          ? "Asset value unavailable"
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
            description={
              quote.status === "stale" ? "Includes a delayed BTC quote" : undefined
            }
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
              initialBtcPrice={quote.usd}
              quoteStatus={quote.status}
              usdtBalance={Number(wallet.usdtBalance)}
              btcBalance={Number(wallet.btcBalance)}
              ethBalance={eth}
              solBalance={sol}
              initialOrders={pendingOrders}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
