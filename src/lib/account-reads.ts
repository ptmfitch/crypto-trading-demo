import prisma from "./prisma";

export async function readWallet(userId: string) {
  return prisma.wallet.findUnique({ where: { userId } });
}

export async function countTrades(userId: string) {
  return prisma.trade.count({ where: { userId } });
}

export async function readProfileTrades(userId: string) {
  return prisma.trade.findMany({
    where: { userId },
    orderBy: { timestamp: "asc" },
  });
}
