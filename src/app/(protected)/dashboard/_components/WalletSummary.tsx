"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ASSET_IDS, ASSETS, isAssetId, QUOTE_SYMBOL, type AssetId } from "@/lib/assets";
import type { BtcQuoteStatus } from "@/lib/btc-quote";
import { useEffect, useState } from "react";

interface WalletSummaryProps {
  usdtBalance: number;
  holdings: { assetId: AssetId; amount: number }[];
  initialPrices: Record<AssetId, number>;
}

const INITIAL_CAPITAL = 10000;

export function WalletSummary({
  usdtBalance,
  holdings,
  initialPrices,
}: WalletSummaryProps) {
  const [prices, setPrices] = useState(initialPrices);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch("/api/markets");
        if (!response.ok) return;
        const data = (await response.json()) as {
          quotes?: Record<string, { usd?: number; status?: BtcQuoteStatus }>;
        };
        setPrices((current) => {
          const next = { ...current };
          for (const id of ASSET_IDS) {
            const usd = data.quotes?.[id]?.usd;
            if (typeof usd === "number" && usd > 0) next[id] = usd;
          }
          return next;
        });
      } catch (error) {
        console.error("Client-side error fetching market prices:", error);
      }
    };
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  const coinValue = holdings.reduce((total, holding) => {
    return total + holding.amount * (prices[holding.assetId] ?? 0);
  }, 0);
  const totalPortfolioValue = usdtBalance + coinValue;
  const pnl = totalPortfolioValue - INITIAL_CAPITAL;
  const pnlPercentage = (pnl / INITIAL_CAPITAL) * 100;
  const pnlColor = pnl >= 0 ? "text-green-500" : "text-red-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{QUOTE_SYMBOL} Balance:</span>
          <span className="font-mono font-semibold">
            ${usdtBalance.toFixed(2)}
          </span>
        </div>
        {holdings.map((holding) => {
          const asset = isAssetId(holding.assetId)
            ? ASSETS[holding.assetId]
            : null;
          if (!asset) return null;
          const value = holding.amount * (prices[holding.assetId] ?? 0);
          return (
            <div key={holding.assetId} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {asset.symbol} Holdings:
                </span>
                <span className="font-mono font-semibold">
                  {holding.amount.toFixed(asset.decimals)} {asset.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{asset.symbol} Value:</span>
                <span className="font-mono font-semibold">
                  ${value.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
        <hr className="my-3" />
        <div className="flex items-center justify-between">
          <span className="font-bold">Total Portfolio Value:</span>
          <span className="text-lg font-bold">
            ${totalPortfolioValue.toFixed(2)}
          </span>
        </div>
        <div
          className={`flex items-center justify-between text-lg ${pnlColor}`}
        >
          <span className="font-bold">Total P&L:</span>
          <span className="font-mono font-bold">
            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnlPercentage.toFixed(2)}%)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
