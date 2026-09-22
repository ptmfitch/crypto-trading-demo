"use client";

import { cancelLimitOrder, placeLimitOrder, tickLimitOrders } from "@/actions/orders";
import { executeTrade } from "@/actions/trade";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ASSET_IDS,
  assetSymbol,
  formatBaseQty,
  formatQuoteUsd,
  isAssetId,
  type AssetId,
  type OrderSide,
  type OrderView,
} from "@/lib/assets";
import {
  quoteDelayLabel,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  amount: z.coerce
    .number()
    .positive({ message: "Amount must be greater than 0" }),
});

const limitSchema = z.object({
  limitPrice: z.string().trim().min(1, "Enter a limit price."),
  amount: z.string().trim().min(1, "Amount must be greater than 0"),
});

interface TradeFormProps {
  initialBtcPrice: number | null;
  quoteStatus: BtcQuoteStatus;
  usdtBalance: number;
  btcBalance: number;
  ethBalance: number;
  solBalance: number;
  initialOrders: OrderView[];
}

type OrderMode = "market" | "limit";
type Row = OrderView & { phase: "pending" | "filled" };

function isQuoteStatus(value: unknown): value is BtcQuoteStatus {
  return value === "fresh" || value === "stale" || value === "unavailable";
}

function isOrderMode(value: string): value is OrderMode {
  return value === "market" || value === "limit";
}

function limitLabel(side: OrderSide, symbol: string): string {
  switch (side) {
    case "BUY":
      return `Buy ${symbol} at ≤`;
    case "SELL":
      return `Sell ${symbol} at ≥`;
    default: {
      const exhaustive: never = side;
      return exhaustive;
    }
  }
}

function sideWord(side: OrderSide): string {
  switch (side) {
    case "BUY":
      return "Buy";
    case "SELL":
      return "Sell";
    default: {
      const exhaustive: never = side;
      return exhaustive;
    }
  }
}

function amountUnit(side: OrderSide, symbol: string): string {
  switch (side) {
    case "BUY":
      return "USDT";
    case "SELL":
      return symbol;
    default: {
      const exhaustive: never = side;
      return exhaustive;
    }
  }
}

function holdingQty(
  assetId: AssetId,
  balances: { bitcoin: number; ethereum: number; solana: number }
): number {
  switch (assetId) {
    case "bitcoin":
      return balances.bitcoin;
    case "ethereum":
      return balances.ethereum;
    case "solana":
      return balances.solana;
    default: {
      const exhaustive: never = assetId;
      return exhaustive;
    }
  }
}

function reservedText(row: Row): string {
  const symbol = assetSymbol(row.assetId);
  if (row.phase === "filled") {
    return `${formatBaseQty(row.baseAmount)} ${symbol}`;
  }
  switch (row.side) {
    case "BUY":
      return `$${formatQuoteUsd(row.quoteReserved)} reserved`;
    case "SELL":
      return `${formatBaseQty(row.baseAmount)} ${symbol} reserved`;
    default: {
      const exhaustive: never = row.side;
      return exhaustive;
    }
  }
}

export function TradeForm({
  initialBtcPrice,
  quoteStatus: initialQuoteStatus,
  usdtBalance,
  btcBalance,
  ethBalance,
  solBalance,
  initialOrders,
}: TradeFormProps) {
  const router = useRouter();
  const [btcPrice, setBtcPrice] = useState<number | null>(initialBtcPrice);
  const [quoteStatus, setQuoteStatus] = useState<BtcQuoteStatus>(
    initialQuoteStatus
  );
  const [tradeType, setTradeType] = useState<OrderSide>("BUY");
  const [orderMode, setOrderMode] = useState<OrderMode>("market");
  const [assetId, setAssetId] = useState<AssetId>("ethereum");
  const [livePrices, setLivePrices] = useState<
    Partial<Record<AssetId, number | null>>
  >({});
  const [rows, setRows] = useState<Row[]>(
    initialOrders.map((order) => ({ ...order, phase: "pending" }))
  );
  const [isPending, startTransition] = useTransition();
  const [isPlacing, startPlace] = useTransition();
  const ticking = useRef(false);
  const routerRef = useRef(router);
  routerRef.current = router;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const initialOrdersRef = useRef(initialOrders);
  initialOrdersRef.current = initialOrders;
  const ordersSignature = initialOrders.map((order) => order.id).join(",");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0 },
  });
  const limitForm = useForm<z.infer<typeof limitSchema>>({
    resolver: zodResolver(limitSchema),
    defaultValues: { limitPrice: "", amount: "" },
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

  // router.refresh() updates initialOrders, but rows is local state. Rebuild
  // pending rows from the server list and keep fill flashes on screen.
  useEffect(() => {
    setRows((current) => {
      const flashes = current.filter((row) => row.phase === "filled");
      const flashIds = new Set(flashes.map((row) => row.id));
      const pending = initialOrdersRef.current
        .filter((order) => !flashIds.has(order.id))
        .map((order) => ({ ...order, phase: "pending" as const }));
      return [...pending, ...flashes];
    });
  }, [ordersSignature]);

  useEffect(() => {
    if (orderMode !== "limit") return;
    let cancel = false;
    async function load() {
      try {
        const response = await fetch("/api/asset-prices", { cache: "no-store" });
        const data = (await response.json()) as {
          prices?: Partial<Record<AssetId, number | null>>;
        };
        if (!cancel && data.prices) setLivePrices(data.prices);
      } catch (error) {
        console.error("Client-side error fetching asset prices:", error);
      }
    }
    void load();
    const interval = setInterval(load, 10000);
    return () => {
      cancel = true;
      clearInterval(interval);
    };
  }, [orderMode]);

  const filledKey = rows
    .filter((row) => row.phase === "filled")
    .map((row) => row.id)
    .join(",");

  useEffect(() => {
    if (!filledKey) return;
    const timeout = setTimeout(() => {
      setRows((current) => current.filter((row) => row.phase !== "filled"));
    }, 2500);
    return () => clearTimeout(timeout);
  }, [filledKey]);

  const hasPending = rows.some((row) => row.phase === "pending");

  useEffect(() => {
    if (!hasPending) return;
    let stopped = false;
    const poll = async () => {
      if (ticking.current || stopped) return;
      ticking.current = true;
      try {
        const result = await tickLimitOrders();
        if (!result.ok) return;
        if (result.filled.length === 0) {
          const localIds = rowsRef.current
            .filter((row) => row.phase === "pending")
            .map((row) => row.id)
            .sort()
            .join(",");
          const remoteIds = result.pending
            .map((order) => order.id)
            .sort()
            .join(",");
          // No fill notice in this tab: another session filled or canceled it.
          if (localIds !== remoteIds) routerRef.current.refresh();
          return;
        }
        const notices = result.filled;
        setRows((current) => {
          const ids = new Set(notices.map((notice) => notice.id));
          const next = current.map((row) =>
            ids.has(row.id) ? { ...row, phase: "filled" as const } : row
          );
          for (const notice of notices) {
            if (next.some((row) => row.id === notice.id)) continue;
            next.unshift({
              id: notice.id,
              side: notice.side,
              assetId: notice.assetId,
              limitPrice: notice.limitPrice,
              baseAmount: notice.baseAmount,
              quoteReserved: notice.limitPrice * notice.baseAmount,
              phase: "filled",
            });
          }
          return next;
        });
        for (const notice of notices) {
          toast.success(notice.message, { duration: 8000 });
        }
        routerRef.current.refresh();
      } catch (error) {
        console.error("Limit order tick failed", error);
      } finally {
        ticking.current = false;
      }
    };
    const interval = setInterval(poll, 2500);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [hasPending]);

  const delayLabel = quoteDelayLabel(quoteStatus);
  const quoteReady = quoteStatus === "fresh" && btcPrice != null && btcPrice > 0;
  const priceText =
    btcPrice == null
      ? "—"
      : `$${btcPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
  const symbol = assetSymbol(assetId);
  const live = livePrices[assetId];
  const liveText =
    typeof live === "number" && live > 0 ? `$${formatQuoteUsd(live)}` : "—";

  function onSubmit(values: z.infer<typeof formSchema>) {
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
      } else {
        toast.error(result.error);
      }
    });
  }

  function onPlaceLimit(values: z.infer<typeof limitSchema>) {
    const limitPrice = Number(values.limitPrice);
    const amount = Number(values.amount);
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      toast.error("Enter a limit price.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    startPlace(async () => {
      const result = await placeLimitOrder({
        side: tradeType,
        assetId,
        limitPrice,
        amount,
      });
      if (!("order" in result) || !result.order) {
        toast.error("error" in result ? result.error : "Trade failed.");
        return;
      }
      const placed = result.order;
      setRows((current) => [
        { ...placed, phase: "pending" },
        ...current.filter((row) => row.id !== placed.id),
      ]);
      limitForm.reset({ limitPrice: "", amount: "" });
      router.refresh();
    });
  }

  function onCancel(orderId: string) {
    startPlace(async () => {
      const result = await cancelLimitOrder(orderId);
      if ("error" in result) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      setRows((current) => current.filter((row) => row.id !== orderId));
      toast("Order canceled");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex w-full flex-col gap-3">
            <ToggleGroup
              type="single"
              value={orderMode}
              onValueChange={(value) => {
                if (isOrderMode(value)) setOrderMode(value);
              }}
              className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
              aria-label="Order type"
            >
              <ToggleGroupItem
                value="market"
                className="h-8 rounded-md text-xs font-semibold data-[state=on]:bg-background data-[state=on]:text-foreground"
              >
                Market
              </ToggleGroupItem>
              <ToggleGroupItem
                value="limit"
                className="h-8 rounded-md text-xs font-semibold data-[state=on]:bg-background data-[state=on]:text-foreground"
              >
                Limit
              </ToggleGroupItem>
            </ToggleGroup>
            <Tabs
              value={tradeType}
              onValueChange={(value) => setTradeType(value as OrderSide)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="BUY">Buy</TabsTrigger>
                <TabsTrigger value="SELL">Sell</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {orderMode === "market" ? (
            <>
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
                          onClick={() => handlePercentageClick(p / 1000)}
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
                  {isPending ? "Processing..." : `${tradeType} BTC`}
                </Button>
                {delayLabel ? (
                  <p className="text-xs text-center text-muted-foreground">
                    Buying and selling stay paused until a live quote returns.
                  </p>
                ) : null}
              </form>
            </>
          ) : (
            <form
              onSubmit={limitForm.handleSubmit(onPlaceLimit, () => {
                toast.error("Enter a limit price and amount.");
              })}
              className="space-y-3"
            >
              <ToggleGroup
                type="single"
                value={assetId}
                onValueChange={(value) => {
                  if (isAssetId(value)) setAssetId(value);
                }}
                className="grid w-full grid-cols-3 rounded-lg bg-muted p-1"
                aria-label="Asset"
              >
                {ASSET_IDS.map((id) => (
                  <ToggleGroupItem
                    key={id}
                    value={id}
                    className="h-8 rounded-md text-xs font-semibold data-[state=on]:bg-background data-[state=on]:text-foreground"
                  >
                    {assetSymbol(id)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="limit-price" className="text-[13px] font-medium">
                  {limitLabel(tradeType, symbol)}
                </label>
                <span
                  className="text-xs tabular-nums text-muted-foreground"
                  aria-label={`Live ${symbol} price`}
                >
                  {liveText}
                </span>
              </div>
              <div className="relative">
                <Input
                  id="limit-price"
                  type="number"
                  step="any"
                  min="0"
                  className="pr-16 text-base font-semibold"
                  placeholder="0.00"
                  {...limitForm.register("limitPrice")}
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-muted-foreground">
                  USDT
                </span>
              </div>
              <label htmlFor="limit-amount" className="text-[13px] font-medium">
                Amount
              </label>
              <div className="relative">
                <Input
                  id="limit-amount"
                  type="number"
                  step="any"
                  min="0"
                  className="pr-16 text-base font-semibold"
                  placeholder="0.00"
                  {...limitForm.register("amount")}
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-muted-foreground">
                  {amountUnit(tradeType, symbol)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Available: {formatQuoteUsd(usdtBalance)} USDT
                {" · "}
                {formatBaseQty(holdingQty(assetId, { bitcoin: btcBalance, ethereum: ethBalance, solana: solBalance }))}{" "}
                {symbol}
              </p>
              <Button
                type="submit"
                className={cn(
                  "h-11 w-full text-sm font-semibold",
                  tradeType === "BUY" &&
                    "bg-[#22c55e] text-[#0a1f0f] hover:bg-[#22c55e]/90"
                )}
                variant={tradeType === "SELL" ? "destructive" : "default"}
                disabled={isPlacing}
              >
                {isPlacing
                  ? "Placing..."
                  : `Place limit ${tradeType === "BUY" ? "buy" : "sell"}`}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 ? (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Pending orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            {rows.map((row) => {
              const rowSymbol = assetSymbol(row.assetId);
              const filled = row.phase === "filled";
              return (
                <div
                  key={row.id}
                  className={cn(
                    "space-y-2 rounded-lg bg-muted p-2.5",
                    filled &&
                      "limit-fill-flash border border-[#22c55e]/40 bg-[#22c55e]/10"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold">
                      {sideWord(row.side)} {rowSymbol}
                    </p>
                    {filled ? (
                      <span className="rounded-full bg-[#22c55e]/20 px-2 py-1 text-[10px] font-semibold text-[#22c55e]">
                        Filled
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#f2b833]/20 px-2 py-1 text-[10px] font-semibold text-[#f2b833]">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>Limit ${formatQuoteUsd(row.limitPrice)}</span>
                    <span>{reservedText(row)}</span>
                  </div>
                  {filled ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-full text-xs text-muted-foreground"
                      onClick={() => onCancel(row.id)}
                      disabled={isPlacing}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
