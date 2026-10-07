import type { Messages } from "@/i18n/en";
import { t } from "@/i18n/translate";
import prisma from "./prisma";

export type TestAccount = {
  email: string;
  name: string;
  summary: string;
};

export function isDevLoginEnabled() {
  return (
    process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "true"
  );
}

function formatUsd(value: { toString(): string } | null | undefined) {
  const amount = Number(value?.toString() ?? "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatBtc(value: { toString(): string } | null | undefined) {
  const amount = Number(value?.toString() ?? "0");
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}

function formatTradeCount(count: number, messages: Messages) {
  if (count === 1) {
    return messages.auth.oneTrade;
  }
  return t(messages, "auth.tradesCount", { count });
}

export async function listTestAccounts(
  messages: Messages
): Promise<TestAccount[]> {
  if (!isDevLoginEnabled()) {
    return [];
  }

  const users = await prisma.user.findMany({
    take: 50,
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      email: true,
      name: true,
      wallet: { select: { usdtBalance: true, btcBalance: true } },
      _count: { select: { trades: true } },
    },
  });

  return users.map((user) => ({
    email: user.email,
    name: user.name?.trim() || messages.auth.unnamedAccount,
    summary: t(messages, "auth.accountSummary", {
      cash: formatUsd(user.wallet?.usdtBalance),
      btc: formatBtc(user.wallet?.btcBalance),
      n: formatTradeCount(user._count.trades, messages),
    }),
  }));
}
