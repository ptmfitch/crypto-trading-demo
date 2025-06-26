import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { DollarSign, ListChecks, TrendingUp, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { StatCard } from "@/components/StatCard";
import { BtcPriceChart } from "./_components/BtcPriceChart";
import { TradeForm } from "./_components/TradeForm";

async function getDashboardData(userId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const [wallet, tradeCount, btcPriceResponse] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.trade.count({ where: { userId } }),
      fetch(`${baseUrl}/api/btc-price`, {
        next: { revalidate: 60 },
      }),
    ]);

    if (!wallet) {
      console.error("Dashboard Error: Wallet not found for user:", userId);
      return null;
    }

    if (!btcPriceResponse.ok) {
      console.error(
        "Dashboard Error: Failed to fetch from /api/btc-price. Status:",
        btcPriceResponse.status
      );
      return null;
    }

    const btcPriceData = await btcPriceResponse.json();
    if (!btcPriceData?.bitcoin?.usd) {
      console.error(
        "Dashboard Error: Invalid data structure from /api/btc-price",
        btcPriceData
      );
      return null;
    }

    const btcPrice = btcPriceData.bitcoin.usd;
    const btcValue = Number(wallet.btcBalance) * btcPrice;
    const totalValue = Number(wallet.usdtBalance) + btcValue;
    const pnl = totalValue - 10000;

    return { wallet, btcPrice, totalValue, pnl, tradeCount };
  } catch (error) {
    console.error("An unexpected error occurred in getDashboardData:", error);
    return null;
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
            There was a problem fetching live market data. Please try refreshing
            the page.
          </p>
        </div>
      </main>
    );
  }

  const { wallet, btcPrice, totalValue, pnl, tradeCount } = data;
  const pnlColor = pnl >= 0 ? "text-green-500" : "text-red-500";

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
            value={`$${totalValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            icon={Wallet}
          />
          <StatCard
            title="Total P&L"
            value={`${pnl >= 0 ? "+" : ""}$${pnl.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            icon={TrendingUp}
            color={pnlColor}
            href="/profile"
          />
          <StatCard
            title="Live BTC Price"
            value={`$${btcPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            icon={DollarSign}
          />
          <StatCard
            title="Total Trades"
            value={tradeCount.toString()}
            icon={ListChecks}
            href="/profile"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Chart takes up 2/3 of the space */}
          <div className="lg:col-span-2">
            <BtcPriceChart />
          </div>

          {/* Trading Form takes up 1/3 of the space */}
          <div className="lg:col-span-1">
            <TradeForm
              initialBtcPrice={btcPrice}
              usdtBalance={Number(wallet.usdtBalance)}
              btcBalance={Number(wallet.btcBalance)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
