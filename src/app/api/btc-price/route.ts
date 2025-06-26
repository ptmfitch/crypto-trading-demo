import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      {
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          bitcoin: { usd: null },
          error: "Failed to fetch price from CoinGecko",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Defensive: ensure structure
    if (!data?.bitcoin?.usd) {
      return NextResponse.json(
        {
          bitcoin: { usd: null },
          error: "Malformed data from CoinGecko",
        },
        { status: 502 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("[BTC Price API Error]", error);
    return NextResponse.json(
      {
        bitcoin: { usd: null },
        error: "Internal Server Error while fetching price.",
      },
      { status: 500 }
    );
  }
}
