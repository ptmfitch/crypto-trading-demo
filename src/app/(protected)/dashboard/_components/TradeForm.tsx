"use client";

import { executeTrade, type TradeErrorCode } from "@/actions/trade";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMessages } from "@/i18n/locale-provider";
import {
  quoteDelayLabel,
  type BtcQuoteStatus,
  type QuoteDelayCode,
} from "@/lib/btc-quote";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface TradeFormProps {
  initialBtcPrice: number | null;
  quoteStatus: BtcQuoteStatus;
  usdtBalance: number;
  btcBalance: number;
}

function createFormSchema(messages: { amountMustBeGreaterThanZero: string }) {
  return z.object({
    amount: z.coerce
      .number()
      .positive({ message: messages.amountMustBeGreaterThanZero }),
  });
}

function isQuoteStatus(value: unknown): value is BtcQuoteStatus {
  return value === "fresh" || value === "stale" || value === "unavailable";
}

function translateDelayCode(
  code: QuoteDelayCode | null,
  messages: { priceDelayed: string; priceUnavailable: string }
) {
  if (!code) return null;
  return code === "priceDelayed"
    ? messages.priceDelayed
    : messages.priceUnavailable;
}

function translateTradeError(
  code: TradeErrorCode,
  messages: {
    notAuthenticated: string;
    invalidInput: string;
    walletNotFound: string;
    insufficientUsdt: string;
    insufficientBtc: string;
    tradeFailed: string;
    tradePaused: string;
  }
) {
  return messages[code];
}

export function TradeForm({
  initialBtcPrice,
  quoteStatus: initialQuoteStatus,
  usdtBalance,
  btcBalance,
}: TradeFormProps) {
  const { messages } = useMessages();
  const t = messages.trade;

  const formSchema = useMemo(() => createFormSchema(t), [t]);

  const [btcPrice, setBtcPrice] = useState<number | null>(initialBtcPrice);
  const [quoteStatus, setQuoteStatus] = useState<BtcQuoteStatus>(
    initialQuoteStatus
  );
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<ReturnType<typeof createFormSchema>>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0 },
  });
  const amount = form.watch("amount");

  const spendAsset: "USDT" | "BTC" = tradeType === "BUY" ? "USDT" : "BTC";
  const receiveAsset = tradeType === "BUY" ? "BTC" : "USDT";
  const spendBalance = tradeType === "BUY" ? usdtBalance : btcBalance;

  const receiveAmount =
    amount > 0 && btcPrice != null && btcPrice > 0
      ? spendAsset === "USDT"
        ? amount / btcPrice
        : amount * btcPrice
      : 0;

  const handlePercentageClick = (percentage: number) => {
    if (tradeType === "SELL" && percentage === 1) {
      form.setValue("amount", parseFloat(btcBalance.toFixed(8)));
    } else {
      const value = spendBalance * percentage;
      form.setValue(
        "amount",
        parseFloat(value.toFixed(spendAsset === "USDT" ? 2 : 8))
      );
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/btc-price", { cache: "no-store" });
        const data = await response.json();
        const usd = data?.bitcoin?.usd;
        const status = data?.quote?.status;
        if (isQuoteStatus(status)) {
          if (status === "unavailable") {
            setBtcPrice(null);
          } else if (typeof usd === "number" && usd > 0) {
            setBtcPrice(usd);
          }
          setQuoteStatus(status);
          return;
        }
        if (typeof usd === "number" && usd > 0) {
          setBtcPrice(usd);
        }
        setQuoteStatus((current) =>
          current === "fresh" ? "stale" : current
        );
      } catch (error) {
        console.error("Client-side error fetching BTC price:", error);
        setQuoteStatus((current) =>
          current === "unavailable" ? "unavailable" : "stale"
        );
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const delayLabel = translateDelayCode(quoteDelayLabel(quoteStatus), t);
  const quoteReady = quoteStatus === "fresh" && btcPrice != null && btcPrice > 0;
  const priceText =
    btcPrice == null
      ? "—"
      : `$${btcPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  const submitLabel = tradeType === "BUY" ? t.buyBtc : t.sellBtc;

  function onSubmit(values: z.infer<ReturnType<typeof createFormSchema>>) {
    if (!quoteReady) {
      toast.error(t.tradePaused);
      return;
    }
    startTransition(async () => {
      const payload = {
        tradeType,
        amount: values.amount,
        asset: spendAsset,
      };
      const result = await executeTrade(payload);
      if (result.success) {
        const template =
          result.success.side === "BUY" ? t.tradeFilledBuy : t.tradeFilledSell;
        toast.success(
          template
            .replace("{btc}", result.success.btc)
            .replace("{usdt}", result.success.usdt)
        );
        form.reset({ amount: 0 });
      } else if (result.error) {
        toast.error(translateTradeError(result.error, t));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <Tabs
          value={tradeType}
          onValueChange={(value) => setTradeType(value as "BUY" | "SELL")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="BUY">{t.buy}</TabsTrigger>
            <TabsTrigger value="SELL">{t.sell}</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3">
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.youPay}</label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                className="pr-16 text-lg"
                {...form.register("amount")}
                placeholder="0.00"
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                {spendAsset}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {t.available}{" "}
                {spendBalance.toFixed(spendAsset === "USDT" ? 2 : 6)}{" "}
                {spendAsset}
              </span>
              <div className="space-x-1">
                {[25, 50, 100].map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePercentageClick(p / 1000)}
                  >
                    {p}%
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t.youReceive}</label>
            <div className="relative">
              <Input
                readOnly
                className="pr-16 text-lg bg-muted/50"
                value={receiveAmount.toFixed(2)}
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                {receiveAsset}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !quoteReady}
          >
            {isPending ? t.processing : submitLabel}
          </Button>
          {delayLabel ? (
            <p className="text-xs text-center text-muted-foreground">
              {t.pausedUntilLiveQuote}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
