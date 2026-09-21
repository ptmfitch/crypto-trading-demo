"use client";

import { executeTrade } from "@/actions/trade";
import { CoinPicker, type PickerQuote } from "./CoinPicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ASSETS,
  ASSET_IDS,
  isAssetId,
  QUOTE_SYMBOL,
  type AssetId,
} from "@/lib/assets";
import {
  quoteDelayLabel,
  TRADE_PAUSED_ERROR,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  amount: z.coerce
    .number()
    .positive({ message: "Amount must be greater than 0" }),
});

interface TradeFormProps {
  initialQuotes: Record<AssetId, PickerQuote>;
  usdtBalance: number;
  holdings: Record<AssetId, number>;
}

function isQuoteStatus(value: unknown): value is BtcQuoteStatus {
  return value === "fresh" || value === "stale" || value === "unavailable";
}

function readQuotes(payload: unknown): Record<AssetId, PickerQuote> | null {
  if (!payload || typeof payload !== "object" || !("quotes" in payload)) {
    return null;
  }
  const quotes = (payload as { quotes?: unknown }).quotes;
  if (!quotes || typeof quotes !== "object") return null;
  const next = {} as Record<AssetId, PickerQuote>;
  for (const id of ASSET_IDS) {
    const row = (quotes as Record<string, unknown>)[id];
    if (!row || typeof row !== "object") return null;
    const record = row as {
      usd?: unknown;
      usd_24h_change?: unknown;
      status?: unknown;
    };
    if (!isQuoteStatus(record.status)) return null;
    next[id] = {
      usd: typeof record.usd === "number" ? record.usd : null,
      usd24hChange:
        typeof record.usd_24h_change === "number" ? record.usd_24h_change : null,
      status: record.status,
    };
  }
  return next;
}

function floorTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.floor(value * factor) / factor;
}

export function TradeForm({
  initialQuotes,
  usdtBalance,
  holdings,
}: TradeFormProps) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [assetId, setAssetId] = useState<AssetId>("bitcoin");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0 },
  });
  const amount = form.watch("amount");
  const asset = ASSETS[assetId];
  const quote = quotes[assetId];
  const price = quote?.usd ?? null;
  const holding = holdings[assetId] ?? 0;
  const spendSymbol = side === "BUY" ? QUOTE_SYMBOL : asset.symbol;
  const receiveSymbol = side === "BUY" ? asset.symbol : QUOTE_SYMBOL;
  const spendBalance = side === "BUY" ? usdtBalance : holding;
  const spendDigits = side === "BUY" ? 2 : asset.decimals;
  const receiveDigits = side === "BUY" ? asset.decimals : 2;

  const receiveAmount =
    amount > 0 && price != null && price > 0
      ? side === "BUY"
        ? amount / price
        : amount * price
      : 0;

  const handlePercentageClick = (percentage: number) => {
    // 100% must spend the exact balance. Rounding the product can exceed it.
    if (percentage === 1) {
      form.setValue("amount", spendBalance);
      return;
    }
    form.setValue("amount", floorTo(spendBalance * percentage, spendDigits));
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/markets", { cache: "no-store" });
        const next = readQuotes(await response.json());
        if (!next) {
          setQuotes((current) => {
            const stale = { ...current };
            for (const id of ASSET_IDS) {
              if (stale[id].status === "fresh") {
                stale[id] = { ...stale[id], status: "stale" };
              }
            }
            return stale;
          });
          return;
        }
        setQuotes(next);
      } catch (error) {
        console.error("Client-side error fetching market prices:", error);
        setQuotes((current) => {
          const stale = { ...current };
          for (const id of ASSET_IDS) {
            stale[id] = {
              ...stale[id],
              status: stale[id].status === "unavailable" ? "unavailable" : "stale",
            };
          }
          return stale;
        });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const delayLabel = quoteDelayLabel(quote?.status ?? "unavailable");
  const quoteReady =
    quote?.status === "fresh" && price != null && price > 0;
  const priceText =
    price == null
      ? "—"
      : `$${price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!quoteReady) {
      toast.error(TRADE_PAUSED_ERROR);
      return;
    }
    startTransition(async () => {
      const result = await executeTrade({
        side,
        amount: values.amount,
        assetId,
      });
      if (result.success) {
        toast.success(result.success);
        form.reset({ amount: 0 });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <Tabs
          value={side}
          onValueChange={(value) => {
            if (value === "BUY" || value === "SELL") setSide(value);
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="BUY">Buy</TabsTrigger>
            <TabsTrigger value="SELL">Sell</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CoinPicker
            assetId={assetId}
            quotes={quotes}
            onAssetId={(next) => {
              if (isAssetId(next)) setAssetId(next);
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                delayLabel && "text-muted-foreground"
              )}
            >
              {priceText}
            </span>
            {delayLabel ? (
              <Badge variant="outline">{delayLabel}</Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">You Pay</label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                className="pr-16 text-lg"
                {...form.register("amount")}
                placeholder="0.00"
              />
              <span className="absolute inset-y-0 right-4 flex items-center font-semibold text-muted-foreground">
                {spendSymbol}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Available: {spendBalance.toFixed(spendDigits)} {spendSymbol}
              </span>
              <div className="space-x-1">
                {[25, 50, 100].map((percent) => (
                  <Button
                    key={percent}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePercentageClick(percent / 100)}
                  >
                    {percent}%
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">You Receive</label>
            <div className="relative">
              <Input
                readOnly
                className="bg-muted/50 pr-16 text-lg"
                value={receiveAmount.toFixed(receiveDigits)}
              />
              <span className="absolute inset-y-0 right-4 flex items-center font-semibold text-muted-foreground">
                {receiveSymbol}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className={cn(
              "w-full text-lg font-semibold",
              quoteReady
                ? side === "BUY"
                  ? "bg-[--buy] text-[--buy-foreground] hover:bg-[--buy]/90"
                  : "bg-[--sell] text-[--sell-foreground] hover:bg-[--sell]/90"
                : "bg-muted text-muted-foreground hover:bg-muted"
            )}
            disabled={isPending || !quoteReady}
          >
            {isPending ? "Processing..." : `${side} ${asset.symbol}`}
          </Button>
          {delayLabel ? (
            <p className="text-center text-xs text-muted-foreground">
              Buying and selling stay paused until a live quote returns.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
