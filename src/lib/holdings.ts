import { seedHoldings } from "@/lib/holding-migration";
import prisma from "@/lib/prisma";

export async function ensureHoldings(userId: string) {
  const existing = await prisma.holding.findMany({
    where: { userId },
    select: { assetId: true },
  });
  const present = new Set(existing.map((row) => row.assetId));
  const missing = seedHoldings(userId).filter((row) => !present.has(row.assetId));
  if (missing.length === 0) return;
  await prisma.holding.createMany({ data: missing });
}
