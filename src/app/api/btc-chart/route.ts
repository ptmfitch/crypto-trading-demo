import { parseChartRange } from "@/lib/btc-chart-range";
import { getBtcChart, getBtcChartRange, parseChartDays } from "@/lib/btc-market";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (from || to) {
    const today = new Date().toISOString().slice(0, 10);
    const range = parseChartRange(from, to, today);
    if (!range.ok) {
      return NextResponse.json(
        { status: "unavailable", points: [], error: range.error },
        { status: 400 }
      );
    }
    const chart = await getBtcChartRange(range.from, range.to);
    return NextResponse.json({
      status: chart.status,
      points: chart.points,
      from: range.from,
      to: range.to,
    });
  }

  const days = parseChartDays(request.nextUrl.searchParams.get("days"));
  if (!days) {
    return NextResponse.json(
      { status: "unavailable", points: [], error: "Unsupported chart range" },
      { status: 400 }
    );
  }

  const chart = await getBtcChart(days);
  return NextResponse.json({
    status: chart.status,
    points: chart.points,
  });
}
