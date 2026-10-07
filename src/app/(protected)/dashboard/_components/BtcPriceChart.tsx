"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { chartFilterLabel, parseChartRange } from "@/lib/btc-chart-range";
import {
  quoteDelayLabel,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

type ChartDataPoint = { date: string; price: number };

const timeRangeOptions = [
  { label: "Last 7 Days", value: "7" },
  { label: "Last 30 Days", value: "30" },
  { label: "Last 3 Months", value: "90" },
  { label: "Last Year", value: "365" },
];

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function chartStatus(value: unknown): BtcQuoteStatus | null {
  if (value === "fresh" || value === "stale" || value === "unavailable") {
    return value;
  }
  return null;
}

export function BtcPriceChart() {
  const [data, setData] = React.useState<ChartDataPoint[]>([]);
  const [loadedRange, setLoadedRange] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [quoteStatus, setQuoteStatus] = React.useState<BtcQuoteStatus>("fresh");
  const [timeRange, setTimeRange] = React.useState("30");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [rangeError, setRangeError] = React.useState<string | null>(null);
  const [filterLabel, setFilterLabel] = React.useState<string | null>(null);
  const dataRef = React.useRef(data);
  const loadedRangeRef = React.useRef(loadedRange);
  dataRef.current = data;
  loadedRangeRef.current = loadedRange;

  const rangeHint =
    (fromDate !== "" || toDate !== "") && (fromDate === "" || toDate === "")
      ? "Choose both dates to filter the chart."
      : null;

  React.useEffect(() => {
    let cancelled = false;
    let requestUrl = `/api/btc-chart?days=${timeRange}`;
    let requestKey = `days:${timeRange}`;

    if (fromDate !== "" && toDate !== "") {
      const parsed = parseChartRange(fromDate, toDate, utcToday());
      if (!parsed.ok) {
        setRangeError(parsed.error);
        setIsLoading(false);
        return;
      }
      setRangeError(null);
      requestKey = `range:${parsed.from}:${parsed.to}`;
      requestUrl = `/api/btc-chart?from=${parsed.from}&to=${parsed.to}`;
    } else {
      setRangeError(null);
    }

    const fetchData = async () => {
      const hasThisRange = loadedRangeRef.current === requestKey;
      if (!hasThisRange) setIsLoading(true);
      try {
        const response = await fetch(requestUrl, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (cancelled) return;
        const points = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.points)
            ? payload.points
            : null;
        const status = chartStatus(payload?.status);
        if (!response.ok || !points) {
          if (typeof payload?.error === "string") setRangeError(payload.error);
          if (hasThisRange && dataRef.current.length > 0) {
            setQuoteStatus("stale");
          } else {
            setData([]);
            setLoadedRange(null);
            setFilterLabel(null);
            setQuoteStatus(status === "stale" ? "stale" : "unavailable");
          }
          return;
        }
        setData(points);
        setLoadedRange(requestKey);
        setQuoteStatus(status ?? "fresh");
        setFilterLabel(
          requestKey.startsWith("range:") &&
            typeof payload.from === "string" &&
            typeof payload.to === "string"
            ? chartFilterLabel(payload.from, payload.to)
            : null
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch chart data", error);
        if (hasThisRange && dataRef.current.length > 0) {
          setQuoteStatus("stale");
        } else {
          setData([]);
          setLoadedRange(null);
          setFilterLabel(null);
          setQuoteStatus("unavailable");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [timeRange, fromDate, toDate]);

  const { chartDomain, isPositiveChange, currentPrice, priceChange } =
    React.useMemo(() => {
      if (!data || data.length === 0) {
        return {
          chartDomain: [0, 0],
          isPositiveChange: true,
          currentPrice: 0,
          priceChange: { value: 0, percent: 0 },
        };
      }

      const prices = data.map((d) => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const padding = (maxPrice - minPrice) * 0.05;

      const startPrice = prices[0];
      const endPrice = prices[prices.length - 1];
      const changeValue = endPrice - startPrice;
      const changePercent = (changeValue / startPrice) * 100;

      return {
        chartDomain: [minPrice - padding, maxPrice + padding],
        isPositiveChange: endPrice >= startPrice,
        currentPrice: endPrice,
        priceChange: { value: changeValue, percent: changePercent },
      };
    }, [data]);

  const strokeColor = isPositiveChange
    ? "hsl(var(--chart-positive))"
    : "hsl(var(--chart-negative))";
  const fillColorId = isPositiveChange ? "fillPositive" : "fillNegative";
  const parsedRange =
    fromDate !== "" && toDate !== ""
      ? parseChartRange(fromDate, toDate, utcToday())
      : null;
  const requestKey = parsedRange?.ok
    ? `range:${parsedRange.from}:${parsedRange.to}`
    : `days:${timeRange}`;
  const showSkeleton = isLoading && loadedRange !== requestKey;
  const delayLabel = quoteDelayLabel(quoteStatus);
  const presetLabel = timeRangeOptions.find((option) => option.value === timeRange);
  const changeSentence =
    data.length === 0
      ? isLoading
        ? "Loading chart"
        : loadedRange?.startsWith("range:")
          ? "No prices in this date range"
          : "Chart unavailable"
      : `${isPositiveChange ? "Increased" : "Decreased"} by $${priceChange.value.toFixed(2)} (${priceChange.percent.toFixed(2)}%)`;
  const windowSentence = filterLabel
    ? `${filterLabel} · ${changeSentence}`
    : presetLabel
      ? `Showing ${presetLabel.label.toLowerCase()} · ${changeSentence}`
      : changeSentence;
  const today = localToday();

  function clearDates() {
    setFromDate("");
    setToDate("");
    setRangeError(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-4 space-y-0 border-b py-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="grid flex-1 gap-1">
          <CardTitle className="flex items-center gap-2">
            Bitcoin Price
            {delayLabel ? <Badge variant="outline">{delayLabel}</Badge> : null}
          </CardTitle>
          <CardDescription>
            {rangeError ?? windowSentence}
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:ml-auto">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="btc-chart-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="btc-chart-from"
                type="date"
                aria-label="From"
                value={fromDate}
                max={toDate || today}
                aria-invalid={rangeError ? true : undefined}
                onChange={(event) => setFromDate(event.target.value)}
                className="w-[11.5rem]"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="btc-chart-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="btc-chart-to"
                type="date"
                aria-label="To"
                value={toDate}
                min={fromDate || undefined}
                max={today}
                aria-invalid={rangeError ? true : undefined}
                onChange={(event) => setToDate(event.target.value)}
                className="w-[11.5rem]"
              />
            </div>
            {fromDate || toDate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearDates}
              >
                Clear dates
              </Button>
            ) : null}
            <Select
              value={timeRange}
              onValueChange={(value) => {
                setTimeRange(value);
                setFromDate("");
                setToDate("");
                setRangeError(null);
              }}
            >
              <SelectTrigger
                className="w-[160px] rounded-lg"
                aria-label="Select a value"
              >
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {timeRangeOptions.map(({ label, value }) => (
                  <SelectItem key={value} value={value} className="rounded-lg">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {rangeHint ? (
            <p className="text-xs text-muted-foreground">{rangeHint}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {showSkeleton ? (
          <Skeleton className="h-[250px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            {loadedRange?.startsWith("range:")
              ? "No prices in this date range"
              : "Chart unavailable"}
          </div>
        ) : (
          <ChartContainer config={{}} className="aspect-auto h-[250px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-positive))"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-positive))"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-negative))"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-negative))"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke={`hsl(var(--muted-foreground), 0.2)`}
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })
                }
              />
              <YAxis
                domain={chartDomain}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) =>
                  `$${(Number(value) / 100).toFixed(1)}k`
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value) => `$${Number(value).toLocaleString()}`}
                  />
                }
              />
              <Area
                dataKey="price"
                type="natural"
                fill={`url(#${fillColorId})`}
                stroke={strokeColor}
                strokeWidth={2}
                dot={false}
              />
              <ReferenceLine
                y={currentPrice}
                stroke={strokeColor}
                strokeDasharray="3 3"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
