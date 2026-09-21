import { auth } from "@/auth";
import { ASSET_IDS } from "@/lib/assets";
import { getMarketQuotes } from "@/lib/btc-market";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quotes = await getMarketQuotes();
  return NextResponse.json({
    quotes: Object.fromEntries(
      ASSET_IDS.map((id) => {
        const quote = quotes[id];
        return [
          id,
          {
            usd: quote.usd,
            usd_24h_change: quote.usd24hChange,
            status: quote.status,
            fetchedAt:
              quote.fetchedAt == null
                ? null
                : new Date(quote.fetchedAt).toISOString(),
            ageMs: quote.ageMs,
          },
        ];
      })
    ),
  });
}
