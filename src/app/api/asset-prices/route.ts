import { ASSET_IDS } from "@/lib/assets";
import { getAssetPrices } from "@/lib/btc-market";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const prices = await getAssetPrices(ASSET_IDS);
  return NextResponse.json({
    prices: {
      bitcoin: prices.bitcoin ?? null,
      ethereum: prices.ethereum ?? null,
      solana: prices.solana ?? null,
    },
  });
}
