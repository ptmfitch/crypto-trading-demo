import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ChartDataPoint {
  date: string;
  price: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days") || "30";
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
      {
        next: { revalidate: 900 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch chart data from CoinGecko");
    }

    const data = await response.json();

    const formattedData: ChartDataPoint[] = data.prices.map(
      (point: [number, number]) => ({
        date: new Date(point[0]).toISOString(),
        price: point[1],
      })
    );

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("[BTC Chart API Error]", error);
    return NextResponse.json(
      { error: "Internal Server Error while fetching chart data." },
      { status: 500 }
    );
  }
}
