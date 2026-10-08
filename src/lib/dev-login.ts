import prisma from "./prisma";

export type TestAccount = {
  email: string;
  name: string | null;
  usdt: number;
  btc: number;
  trades: number;
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

export function formatTestAccountSummary(
  account: Pick<TestAccount, "usdt" | "btc">,
  labels: { cash: string; trades: string }
) {
  return `${formatUsd(account.usdt)} ${labels.cash} · ${formatBtc(account.btc)} BTC · ${labels.trades}`;
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
      wallet: { select: { usdtBalance: true, btcBalance: true } },
      _count: { select: { trades: true } },
    },
  });

  return users.map((user) => ({
    email: user.email,
    name: user.name,
    usdt: Number(user.wallet?.usdtBalance ?? 0),
    btc: Number(user.wallet?.btcBalance ?? 0),
    trades: user._count.trades,
  }));
}
