import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { DollarSign, ListChecks, TrendingUp, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { StatCard } from "@/components/StatCard";
import { getDictionary } from "@/i18n/get-dictionary";
import { getBtcQuote } from "@/lib/btc-market";
import {
  quoteDelayLabel,
  type BtcQuoteStatus,
  type QuoteDelayCode,
} from "@/lib/btc-quote";
import { BtcPriceChart } from "./_components/BtcPriceChart";
import { TradeForm } from "./_components/TradeForm";

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function translateDelayCode(
  code: QuoteDelayCode | null,
  messages: { priceDelayed: string; priceUnavailable: string }
) {
  if (!code) return undefined;
  return code === "priceDelayed"
    ? messages.priceDelayed
    : messages.priceUnavailable;
}

function priceStat(
  status: BtcQuoteStatus,
  usd: number | null,
  messages: { priceDelayed: string; priceUnavailable: string }
) {
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
        description: translateDelayCode(quoteDelayLabel(status), messages),
        color: "text-muted-foreground",
      };
    case "unavailable":
      return {
        value: "—",
        description: translateDelayCode(quoteDelayLabel(status), messages),
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

  const { messages } = await getDictionary();
  const t = messages.dashboard;

  const data = await getDashboardData(session.user.id);
  if (!data) {
    return (
      <main className="flex-1 bg-muted/40">
        <div className="container mx-auto py-8 text-center">
          <h2 className="text-xl font-semibold text-destructive">
            {t.loadErrorTitle}
          </h2>
          <p className="text-muted-foreground">{t.loadErrorDescription}</p>
        </div>
      </main>
    );
  }

  const { wallet, quote, totalValue, pnl, tradeCount } = data;
  const pnlColor =
    pnl == null ? "text-muted-foreground" : pnl >= 0 ? "text-green-500" : "text-red-500";
  const price = priceStat(quote.status, quote.usd, t);
  const portfolioDescription =
    quote.status === "stale"
      ? t.includesDelayedQuote
      : quote.status === "unavailable" && totalValue == null
        ? t.btcValueUnavailable
        : undefined;

  const displayName = session.user.name || t.traderFallback;
  const welcomeTitle = t.welcomeBack.replace("{name}", displayName);

  return (
    <main className="flex-1 bg-muted/40">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{welcomeTitle}</h1>
          <p className="text-muted-foreground">{t.overview}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            title={t.portfolioValue}
            value={totalValue == null ? "—" : formatUsd(totalValue)}
            icon={Wallet}
            description={portfolioDescription}
          />
          <StatCard
            title={t.totalPnl}
            value={
              pnl == null
                ? "—"
                : `${pnl >= 0 ? "+" : ""}${formatUsd(pnl)}`
            }
            icon={TrendingUp}
            color={pnlColor}
            href="/profile"
            description={
              quote.status === "stale" ? t.includesDelayedQuote : undefined
            }
          />
          <StatCard
            title={t.liveBtcPrice}
            value={price.value}
            icon={DollarSign}
            color={price.color}
            description={price.description}
          />
          <StatCard
            title={t.totalTrades}
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
            />
          </div>
        </div>
      </div>
    </main>
  );
}
