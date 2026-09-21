import { ASSET_IDS, ASSETS } from "./assets";
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

function formatCoin(value: { toString(): string } | null | undefined) {
  const amount = Number(value?.toString() ?? "0");
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}

function tradeLabel(count: number) {
  return count === 1 ? "1 trade" : `${count} trades`;
}

export async function listTestAccounts(): Promise<TestAccount[]> {
  if (!isDevLoginEnabled()) {
    return [];
  }

  const users = await prisma.user.findMany({
    take: 50,
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      email: true,
      name: true,
      wallet: { select: { usdtBalance: true } },
      holdings: { select: { assetId: true, amount: true } },
      _count: { select: { trades: true } },
    },
  });

  return users.map((user) => {
    const amounts = new Map(
      user.holdings.map((holding) => [holding.assetId, holding.amount])
    );
    const coins = ASSET_IDS.map((id) => {
      return `${formatCoin(amounts.get(id))} ${ASSETS[id].symbol}`;
    }).join(" · ");
    return {
      email: user.email,
      name: user.name?.trim() || "Unnamed account",
      summary: `${formatUsd(user.wallet?.usdtBalance)} cash · ${coins} · ${tradeLabel(user._count.trades)}`,
    };
  });
}
