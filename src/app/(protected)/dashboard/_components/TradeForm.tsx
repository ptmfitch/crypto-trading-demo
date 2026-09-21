"use client";

import { executeTrade } from "@/actions/trade";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  initialBtcPrice: number;
  usdtBalance: number;
  btcBalance: number;
}

function isTradeType(value: string): value is TradeType {
  return value === "BUY" || value === "SELL";
}

function sideLabel(tradeType: TradeType) {
  switch (tradeType) {
    case "BUY":
      return "Buy BTC";
    case "SELL":
      return "Sell BTC";
    default: {
      const unreachable: never = tradeType;
      return unreachable;
    }
  }
}

function reviewLabel(tradeType: TradeType) {
  switch (tradeType) {
    case "BUY":
      return "Review buy";
    case "SELL":
      return "Review sell";
    default: {
      const unreachable: never = tradeType;
      return unreachable;
    }
  }
}

function confirmLabel(tradeType: TradeType) {
  switch (tradeType) {
    case "BUY":
      return "Confirm buy";
    case "SELL":
      return "Confirm sell";
    default: {
      const unreachable: never = tradeType;
      return unreachable;
    }
  }
}

function quoteReceive(spend: number, price: number, spendingUsdt: boolean) {
  if (!(spend > 0) || !(price > 0)) return 0;
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

export function TradeForm({
  initialBtcPrice,
  usdtBalance,
  btcBalance,
}: TradeFormProps) {
  const [btcPrice, setBtcPrice] = useState(initialBtcPrice);
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
    shouldUnregister: false,
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
        const response = await fetch("/api/btc-price");
        const data = await response.json();
        if (typeof data.bitcoin?.usd === "number") {
          setPriceUpdatedAt(Date.now());
          setBtcPrice(data.bitcoin.usd);
        }
      } catch {
        // Keep the last price. The next poll retries.
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

  function returnToAmount() {
    setStep("amount");
    setPricePulse(false);
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (step === "amount") {
      // Spend is captured here and stays put while the live price updates the receive estimate.
      setReviewedAmount(values.amount);
      setStep("review");
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

  const actionClass =
    tradeType === "BUY"
      ? "bg-[hsl(var(--buy))] text-[hsl(var(--buy-foreground))] hover:bg-[hsl(var(--buy)/0.9)]"
      : "bg-[hsl(var(--sell))] text-[hsl(var(--sell-foreground))] hover:bg-[hsl(var(--sell)/0.9)]";

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === "amount" ? (
            <>
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
                    placeholder="0.00"
                    {...form.register("amount")}
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
                        onClick={() => handlePercentageClick(p / 100)}
                      >
                        {p}%
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
                    className="pr-16 text-lg bg-muted/50"
                    value={receiveAmount.toFixed(
                      receiveAsset === "USDT" ? 2 : 8
                    )}
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                    {receiveAsset}
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className={cn("w-full text-lg font-semibold", actionClass)}
                disabled={isPending || !(numericAmount > 0)}
              >
                {reviewLabel(tradeType)}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-3 rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-sm font-semibold">{sideLabel(tradeType)}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Spend</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {formatSpend(reviewedAmount ?? 0, spendAsset)}
                  </dd>
                  <dt className="text-muted-foreground">Receive</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {formatReceive(reviewedReceive, receiveAsset)}
                  </dd>
                  <dt className="text-muted-foreground">Price</dt>
                  <dd
                    className={cn(
                      "text-right font-medium tabular-nums",
                      pricePulse && "animate-pulse"
                    )}
                  >
                    ${formatNumber(btcPrice, 2, 2)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Live
                      {priceUpdatedAt
                        ? ` · ${formatQuoteTime(priceUpdatedAt)}`
                        : ""}
                    </span>
                  </dd>
                </dl>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={returnToAmount}
                  disabled={isPending}
                >
                  Edit
                </Button>
                <Button
                  type="submit"
                  className={cn("w-full text-lg font-semibold", actionClass)}
                  disabled={isPending || !(reviewedAmount && reviewedAmount > 0)}
                >
                  {isPending ? "Processing..." : confirmLabel(tradeType)}
                </Button>
              </div>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
