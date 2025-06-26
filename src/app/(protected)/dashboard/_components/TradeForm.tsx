"use client";

import { executeTrade } from "@/actions/trade";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  initialBtcPrice: number;
  usdtBalance: number;
  btcBalance: number;
}

export function TradeForm({
  initialBtcPrice,
  usdtBalance,
  btcBalance,
}: TradeFormProps) {
  const [btcPrice, setBtcPrice] = useState(initialBtcPrice);
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0 },
  });
  const amount = form.watch("amount");

  // Determine which asset is being spent and which is being received
  const spendAsset: "USDT" | "BTC" = tradeType === "BUY" ? "USDT" : "BTC";
  const receiveAsset = tradeType === "BUY" ? "BTC" : "USDT";
  const spendBalance = tradeType === "BUY" ? usdtBalance : btcBalance;

  // Calculate the received amount based on the input amount
  const receiveAmount =
    amount > 0 && btcPrice > 0
      ? spendAsset === "USDT"
        ? amount / btcPrice
        : amount * btcPrice
      : 0;

  // Function to handle quick percentage clicks
  const handlePercentageClick = (percentage: number) => {
    if (tradeType === "SELL" && percentage === 1) {
      // For 100% sell, use the exact btcBalance
      form.setValue("amount", parseFloat(btcBalance.toFixed(8)));
    } else {
      const value = spendBalance * percentage;
      form.setValue(
        "amount",
        parseFloat(value.toFixed(spendAsset === "USDT" ? 2 : 8))
      );
    }
  };

  // Refetch price periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch("/api/btc-price");
      const data = await response.json();
      if (data.bitcoin?.usd) setBtcPrice(data.bitcoin.usd);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  function onSubmit(values: z.infer<typeof formSchema>) {
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
      } else {
        toast.error(result.error);
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
            <TabsTrigger value="BUY">Buy</TabsTrigger>
            <TabsTrigger value="SELL">Sell</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* --- SPEND INPUT --- */}
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
              <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                {spendAsset}
              </span>
            </div>
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
                    onClick={() => handlePercentageClick(p / 100)}
                  >
                    {p}%
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* --- RECEIVE DISPLAY --- */}
          <div className="space-y-2">
            <label className="text-sm font-medium">You Receive</label>
            <div className="relative">
              <Input
                readOnly
                className="pr-16 text-lg bg-muted/50"
                value={receiveAmount.toFixed(receiveAsset === "USDT" ? 2 : 8)}
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                {receiveAsset}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className={cn(
              "w-full text-lg font-semibold",
              tradeType === "BUY"
                ? "bg-[--buy] text-[--buy-foreground] hover:bg-[--buy]/90"
                : "bg-[--sell] text-[--sell-foreground] hover:bg-[--sell]/90"
            )}
            disabled={isPending}
          >
            {isPending ? "Processing..." : `${tradeType} BTC`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
