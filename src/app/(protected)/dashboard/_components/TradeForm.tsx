"use client";

import { executeTrade } from "@/actions/trade";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  quoteDelayLabel,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import {
  balanceFieldError,
  tradeAmountSchema,
  youReceiveAccessibleName,
} from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface TradeFormProps {
  initialBtcPrice: number | null;
  quoteStatus: BtcQuoteStatus;
  usdtBalance: number;
  btcBalance: number;
}

function isQuoteStatus(value: unknown): value is BtcQuoteStatus {
  return value === "fresh" || value === "stale" || value === "unavailable";
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
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [isPending, startTransition] = useTransition();
  const receiveFieldId = useId();
  const amountRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof tradeAmountSchema>>({
    resolver: zodResolver(tradeAmountSchema),
    defaultValues: { amount: 0 },
  });
  const amount = form.watch("amount");

  // Determine which asset is being spent and which is being received
  const spendAsset: "USDT" | "BTC" = tradeType === "BUY" ? "USDT" : "BTC";
  const receiveAsset = tradeType === "BUY" ? "BTC" : "USDT";
  const spendBalance = tradeType === "BUY" ? usdtBalance : btcBalance;

  // Calculate the received amount based on the input amount
  const receiveAmount =
    amount > 0 && btcPrice != null && btcPrice > 0
      ? spendAsset === "USDT"
        ? amount / btcPrice
        : amount * btcPrice
      : 0;

  // Function to handle quick percentage clicks
  const handlePercentageClick = (percentage: number) => {
    const next =
      tradeType === "SELL" && percentage === 1
        ? // For 100% sell, use the exact btcBalance
          parseFloat(btcBalance.toFixed(8))
        : parseFloat(
            (spendBalance * percentage).toFixed(spendAsset === "USDT" ? 2 : 8)
          );
    // The amount input is uncontrolled, so the DOM value has to be set too.
    if (amountRef.current) {
      amountRef.current.value = String(next);
    }
    form.setValue("amount", next, { shouldValidate: true });
  };

  // Refetch price periodically. A failed refresh keeps the last quote and
  // marks it delayed instead of clearing the form.
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

  const delayLabel = quoteDelayLabel(quoteStatus);
  const quoteReady = quoteStatus === "fresh" && btcPrice != null && btcPrice > 0;
  const priceText =
    btcPrice == null
      ? "—"
      : `$${btcPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  function onSubmit(values: z.infer<typeof tradeAmountSchema>) {
    if (!quoteReady) {
      toast.error("Trading is paused until a live BTC quote returns.");
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
        toast.success(result.success);
        form.reset({ amount: 0 });
        if (amountRef.current) {
          amountRef.current.value = "0";
        }
      } else {
        toast.error(result.error);
        const fieldError = balanceFieldError(result.error);
        if (fieldError) {
          form.setError(
            "amount",
            { message: fieldError },
            { shouldFocus: true }
          );
        }
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <Tabs
          value={tradeType}
          onValueChange={(value) => {
            setTradeType(value as "BUY" | "SELL");
            form.clearErrors("amount");
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* --- SPEND INPUT --- */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>You Pay</FormLabel>
                <div className="relative">
                  <FormControl>
                    {/* Uncontrolled so a trailing "." stays put. Binding value
                        rewrites the number input on the validation re-render
                        and the in-progress decimal disappears. */}
                    <Input
                      type="number"
                      step="any"
                      className="pr-16 text-lg"
                      placeholder="0.00"
                      name={field.name}
                      defaultValue={0}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      ref={(node) => {
                        amountRef.current = node;
                        field.ref(node);
                      }}
                    />
                  </FormControl>
                  <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                    {spendAsset}
                  </span>
                </div>
                <FormMessage />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Available: {spendBalance.toFixed(spendAsset === "USDT" ? 2 : 6)}{" "}
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
              </FormItem>
            )}
          />

          {/* --- RECEIVE DISPLAY --- */}
          <div className="space-y-2">
            <Label htmlFor={receiveFieldId}>
              {/* Visible text stays "You Receive". The name includes the asset once. */}
              <span aria-hidden="true">You Receive</span>
              <span className="sr-only">
                {youReceiveAccessibleName(receiveAsset)}
              </span>
            </Label>
            <div className="relative">
              <Input
                id={receiveFieldId}
                readOnly
                className="pr-16 text-lg bg-muted/50"
                value={receiveAmount.toFixed(2)}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold"
              >
                {receiveAsset}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !quoteReady}
          >
            {isPending ? "Processing..." : `${tradeType} BTC`}
          </Button>
          {delayLabel ? (
            <p className="text-xs text-center text-muted-foreground">
              Buying and selling stay paused until a live quote returns.
            </p>
          ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
