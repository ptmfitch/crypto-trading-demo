"use client";

import { executeTrade } from "@/actions/trade";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  quoteDelayLabel,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  amount: z.coerce
    .number()
    .positive({ message: "Amount must be greater than 0" }),
});

type TradeType = "BUY" | "SELL";
type SpendAsset = "USDT" | "BTC";
type Step = "amount" | "review";

interface TradeFormProps {
  initialBtcPrice: number | null;
  quoteStatus: BtcQuoteStatus;
  usdtBalance: number;
  btcBalance: number;
}

function isQuoteStatus(value: unknown): value is BtcQuoteStatus {
  return value === "fresh" || value === "stale" || value === "unavailable";
}

function isTradeType(value: string): value is TradeType {
  return value === "BUY" || value === "SELL";
}

function sideTypeLabel(tradeType: TradeType) {
  return tradeType === "BUY" ? "Buy BTC" : "Sell BTC";
}

function reviewButtonLabel(tradeType: TradeType) {
  return tradeType === "BUY" ? "Review buy" : "Review sell";
}

function confirmButtonLabel(tradeType: TradeType) {
  return tradeType === "BUY" ? "Confirm buy" : "Confirm sell";
}

function quoteReceive(spend: number, price: number | null, spendingUsdt: boolean) {
  if (!(spend > 0) || price == null || !(price > 0)) return 0;
  return spendingUsdt ? spend / price : spend * price;
}

function formatNumber(value: number, minDigits: number, maxDigits: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
}

function formatSpend(amount: number, asset: SpendAsset) {
  if (asset === "USDT") return `$${formatNumber(amount, 2, 2)}`;
  return `${formatNumber(amount, 2, 8)} BTC`;
}

function formatReceive(amount: number, asset: SpendAsset) {
  if (asset === "USDT") return `≈ $${formatNumber(amount, 2, 2)}`;
  return `≈ ${formatNumber(amount, 2, 8)} BTC`;
}

function formatQuoteTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function receiveDecimals(asset: SpendAsset) {
  return asset === "USDT" ? 2 : 8;
}

export function TradeForm({
  initialBtcPrice,
  quoteStatus: initialQuoteStatus,
  usdtBalance,
  btcBalance,
}: TradeFormProps) {
  const [btcPrice, setBtcPrice] = useState<number | null>(initialBtcPrice);
  const [quoteStatus, setQuoteStatus] = useState<BtcQuoteStatus>(
    initialQuoteStatus
  );
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<number | null>(null);
  const [pricePulse, setPricePulse] = useState(false);
  const [tradeType, setTradeType] = useState<TradeType>("BUY");
  const [step, setStep] = useState<Step>("amount");
  const [reviewedAmount, setReviewedAmount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const reviewQuoteAt = useRef<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0 },
  });
  const amount = form.watch("amount");

  const spendAsset: SpendAsset = tradeType === "BUY" ? "USDT" : "BTC";
  const receiveAsset: SpendAsset = tradeType === "BUY" ? "BTC" : "USDT";
  const spendBalance = tradeType === "BUY" ? usdtBalance : btcBalance;
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  const receiveAmount = quoteReceive(
    numericAmount,
    btcPrice,
    spendAsset === "USDT"
  );
  const reviewedReceive = quoteReceive(
    reviewedAmount ?? 0,
    btcPrice,
    spendAsset === "USDT"
  );

  const handlePercentageClick = (percentage: number) => {
    if (tradeType === "SELL" && percentage === 1) {
      form.setValue("amount", parseFloat(btcBalance.toFixed(8)), {
        shouldValidate: true,
      });
    } else {
      const value = spendBalance * percentage;
      form.setValue(
        "amount",
        parseFloat(value.toFixed(spendAsset === "USDT" ? 2 : 8)),
        { shouldValidate: true }
      );
    }
  };

  useEffect(() => {
    setPriceUpdatedAt(Date.now());
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/btc-price", { cache: "no-store" });
        const data = await response.json();
        const usd = data?.bitcoin?.usd;
        const status = data?.quote?.status;
        const fetchedAtRaw = data?.quote?.fetchedAt;
        const fetchedAtMs =
          typeof fetchedAtRaw === "string"
            ? Date.parse(fetchedAtRaw)
            : Number.NaN;

        if (isQuoteStatus(status)) {
          if (status === "unavailable") {
            setBtcPrice(null);
          } else if (typeof usd === "number" && usd > 0) {
            setBtcPrice(usd);
            if (Number.isFinite(fetchedAtMs)) {
              setPriceUpdatedAt(fetchedAtMs);
            } else {
              setPriceUpdatedAt(Date.now());
            }
          }
          setQuoteStatus(status);
          return;
        }
        if (typeof usd === "number" && usd > 0) {
          setBtcPrice(usd);
          setPriceUpdatedAt(Date.now());
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

  useEffect(() => {
    if (step !== "review") {
      reviewQuoteAt.current = null;
      return;
    }
    if (reviewQuoteAt.current === null) {
      reviewQuoteAt.current = priceUpdatedAt;
      return;
    }
    if (priceUpdatedAt === null || priceUpdatedAt === reviewQuoteAt.current) {
      return;
    }
    setPricePulse(true);
    const timeout = window.setTimeout(() => setPricePulse(false), 700);
    return () => window.clearTimeout(timeout);
  }, [priceUpdatedAt, step]);

  const delayLabel = quoteDelayLabel(quoteStatus);
  const quoteReady = quoteStatus === "fresh" && btcPrice != null && btcPrice > 0;
  const priceText =
    btcPrice == null
      ? "—"
      : `$${btcPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  function returnToAmount() {
    setStep("amount");
    setPricePulse(false);
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (step === "amount") {
      if (!quoteReady) {
        toast.error("Trading is paused until a live BTC quote returns.");
        return;
      }
      setReviewedAmount(values.amount);
      setStep("review");
      return;
    }

    if (!quoteReady) {
      toast.error("Trading is paused until a live BTC quote returns.");
      return;
    }

    const spend = reviewedAmount ?? values.amount;
    startTransition(async () => {
      const result = await executeTrade({
        tradeType,
        amount: spend,
        asset: spendAsset,
      });
      if (result.success) {
        toast.success(result.success);
        form.reset({ amount: 0 });
        setReviewedAmount(null);
        setStep("amount");
      } else {
        toast.error(result.error);
      }
    });
  }

  const buyActionClass =
    "bg-[hsl(var(--chart-positive))] text-white hover:bg-[hsl(var(--chart-positive)/0.9)]";
  const sellActionClass = "bg-destructive text-white hover:bg-destructive/90";
  const actionClass = tradeType === "BUY" ? buyActionClass : sellActionClass;

  const payReadOnly = step === "review";

  return (
    <Card>
      <CardHeader>
        <Tabs
          value={tradeType}
          onValueChange={(value) => {
            if (!isTradeType(value)) return;
            setTradeType(value);
            returnToAmount();
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
            <label htmlFor="trade-amount" className="text-sm font-medium">
              You Pay
            </label>
            <div className="relative">
              <Input
                id="trade-amount"
                type="number"
                step="any"
                className="pr-16 text-lg"
                readOnly={payReadOnly}
                aria-readonly={payReadOnly}
                {...form.register("amount")}
                placeholder="0.00"
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                {spendAsset}
              </span>
            </div>
            {form.formState.errors.amount ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.amount.message}
              </p>
            ) : null}
            {step === "amount" ? (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  Available:{" "}
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
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">You Receive</label>
            <div className="relative">
              <Input
                readOnly
                className="pr-16 text-lg bg-muted/50"
                value={receiveAmount.toFixed(receiveDecimals(receiveAsset))}
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                {receiveAsset}
              </span>
            </div>
          </div>

          {step === "review" ? (
            <div className="space-y-3 rounded-lg border bg-muted/40 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {reviewButtonLabel(tradeType)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1"
                  onClick={returnToAmount}
                  disabled={isPending}
                >
                  Edit
                </Button>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="text-right font-medium tabular-nums">
                  {sideTypeLabel(tradeType)}
                </dd>
                <dt className="text-muted-foreground">Spend</dt>
                <dd className="text-right font-medium tabular-nums">
                  {formatSpend(reviewedAmount ?? 0, spendAsset)}
                </dd>
                <dt className="text-muted-foreground">Receive</dt>
                <dd className="text-right font-medium tabular-nums">
                  {formatReceive(reviewedReceive, receiveAsset)}
                </dd>
                <dt className="text-muted-foreground">Price (live)</dt>
                <dd
                  className={cn(
                    "text-right font-medium tabular-nums",
                    pricePulse && "animate-pulse"
                  )}
                >
                  {priceText}
                  {quoteReady && priceUpdatedAt ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      · {formatQuoteTime(priceUpdatedAt)}
                    </span>
                  ) : null}
                </dd>
              </dl>
            </div>
          ) : null}

          <Button
            type="submit"
            className={cn("w-full text-lg font-semibold", actionClass)}
            disabled={
              isPending ||
              !quoteReady ||
              (step === "amount"
                ? !(numericAmount > 0)
                : !(reviewedAmount != null && reviewedAmount > 0))
            }
          >
            {isPending
              ? "Processing..."
              : step === "amount"
                ? reviewButtonLabel(tradeType)
                : confirmButtonLabel(tradeType)}
          </Button>
          {delayLabel ? (
            <p className="text-xs text-center text-muted-foreground">
              Buying and selling stay paused until a live quote returns.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
