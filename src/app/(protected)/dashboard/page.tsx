import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

import { getBtcQuote } from "@/lib/btc-market";
import { quoteDelayLabel, type BtcQuoteStatus, usdToGbpAmount } from "@/lib/btc-quote";
import { BtcPriceChart } from "./_components/BtcPriceChart";
import { DashboardStats } from "./_components/DashboardStats";
import { TradeForm } from "./_components/TradeForm";

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatGbp(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatGbpSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${formatGbp(value)}`;
}

function portfolioValue(usdt: number, btc: number, usd: number | null) {
  if (usd != null) return usdt + btc * usd;
  if (btc === 0) return usdt;
  return null;
}

async function getDashboardData(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    console.error("Dashboard Error: Wallet not found for user:", userId);
    return null;
  }

  const [tradeCount, quote] = await Promise.all([
    prisma.trade.count({ where: { userId } }),
    getBtcQuote(),
  ]);

  const usdt = Number(wallet.usdtBalance);
  const btc = Number(wallet.btcBalance);
  const totalValue = portfolioValue(usdt, btc, quote.usd);
  const pnl = totalValue == null ? null : totalValue - 10000;

  return { wallet, tradeCount, quote, totalValue, pnl };
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

  const { wallet, quote, totalValue, pnl, tradeCount } = data;
  const pnlColor =
    pnl == null ? "text-muted-foreground" : pnl >= 0 ? "text-green-500" : "text-red-500";
  const price = priceStat(quote.status, quote.usd);
  const gbpAvailable = quote.gbp != null;
  const portfolioGbp =
    totalValue == null ? null : usdToGbpAmount(totalValue, quote);
  const pnlGbp = pnl == null ? null : usdToGbpAmount(pnl, quote);
  const portfolioDescription =
    quote.status === "stale"
      ? "Includes a delayed BTC quote"
      : quote.status === "unavailable" && totalValue == null
        ? "BTC value unavailable"
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

        <DashboardStats
          portfolioValue={totalValue == null ? "—" : formatUsd(totalValue)}
          portfolioGbp={portfolioGbp == null ? null : formatGbp(portfolioGbp)}
          portfolioDescription={portfolioDescription}
          pnlValue={
            pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}${formatUsd(pnl)}`
          }
          pnlGbp={pnlGbp == null ? null : formatGbpSigned(pnlGbp)}
          pnlColor={pnlColor}
          pnlDescription={
            quote.status === "stale" ? "Includes a delayed BTC quote" : undefined
          }
          priceValue={price.value}
          priceGbp={quote.gbp == null ? null : formatGbp(quote.gbp)}
          priceColor={price.color}
          priceDescription={price.description}
          tradeCount={tradeCount.toString()}
          gbpAvailable={gbpAvailable}
        />

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
            />
          </div>
        </div>
      </div>
    </main>
  );
}
