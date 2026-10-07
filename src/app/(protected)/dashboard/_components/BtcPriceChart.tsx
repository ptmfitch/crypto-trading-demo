"use client";

import { Badge } from "@/components/ui/badge";
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
import {
  chartDateIssue,
  chartDateMessage,
  chartDaysForWindow,
  chartHistoryStart,
  clampChartDate,
  filterPointsByDateWindow,
  pointCalendarDay,
  type ChartDateIssue,
  type ChartPresetDays,
} from "@/lib/btc-chart-window";
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

const timeRangeOptions: { label: string; value: ChartPresetDays }[] = [
  { label: "Last 7 Days", value: "7" },
  { label: "Last 30 Days", value: "30" },
  { label: "Last 3 Months", value: "90" },
  { label: "Last Year", value: "365" },
];

const CUSTOM_RANGE = "custom";

function chartStatus(value: unknown): BtcQuoteStatus | null {
  if (value === "fresh" || value === "stale" || value === "unavailable") {
    return value;
  }
  return null;
}

function isPresetDays(value: string): value is ChartPresetDays {
  return timeRangeOptions.some((option) => option.value === value);
}

export function BtcPriceChart() {
  const [data, setData] = React.useState<ChartDataPoint[]>([]);
  const [loadedRange, setLoadedRange] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [quoteStatus, setQuoteStatus] = React.useState<BtcQuoteStatus>("fresh");
  const [preset, setPreset] = React.useState<ChartPresetDays>("30");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [customWindow, setCustomWindow] = React.useState<{
    start: string;
    end: string;
  } | null>(null);
  const [rangeIssue, setRangeIssue] = React.useState<ChartDateIssue | null>(
    null
  );
  const [today, setToday] = React.useState<string | null>(null);
  const [timeZone, setTimeZone] = React.useState("UTC");
  const dataRef = React.useRef(data);
  const loadedRangeRef = React.useRef(loadedRange);
  dataRef.current = data;
  loadedRangeRef.current = loadedRange;

  React.useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimeZone(zone);
    setToday(pointCalendarDay(new Date().toISOString(), zone));
  }, []);

  const fetchDays: ChartPresetDays =
    customWindow && today
      ? (chartDaysForWindow(customWindow.start, today) ?? preset)
      : preset;

  React.useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      const hasThisRange = loadedRangeRef.current === fetchDays;
      if (!hasThisRange) setIsLoading(true);
      try {
        const response = await fetch(`/api/btc-chart?days=${fetchDays}`, {
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
        if (!response.ok || !points || points.length === 0) {
          if (hasThisRange && dataRef.current.length > 0) {
            setQuoteStatus("stale");
          } else {
            setData([]);
            setLoadedRange(null);
            setQuoteStatus(status === "stale" ? "stale" : "unavailable");
          }
          return;
        }
        setData(points);
        setLoadedRange(fetchDays);
        setQuoteStatus(status ?? "fresh");
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch chart data", error);
        if (hasThisRange && dataRef.current.length > 0) {
          setQuoteStatus("stale");
        } else {
          setData([]);
          setLoadedRange(null);
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
  }, [fetchDays]);

  const shown = React.useMemo(() => {
    if (!customWindow || loadedRange !== fetchDays) return data;
    return filterPointsByDateWindow(
      data,
      customWindow.start,
      customWindow.end,
      timeZone
    );
  }, [customWindow, data, fetchDays, loadedRange, timeZone]);

  const { chartDomain, isPositiveChange, currentPrice, priceChange } =
    React.useMemo(() => {
      if (!shown || shown.length === 0) {
        return {
          chartDomain: [0, 0],
          isPositiveChange: true,
          currentPrice: 0,
          priceChange: { value: 0, percent: 0 },
        };
      }

      const prices = shown.map((d) => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const padding =
        minPrice === maxPrice
          ? Math.abs(minPrice) * 0.01 || 1
          : (maxPrice - minPrice) * 0.05;

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
    }, [shown]);

  function applyDates(
    start: string,
    end: string,
    clampIssue: Exclude<ChartDateIssue, "end-before-start"> | null
  ) {
    if (!today) return;
    if (!start || !end) {
      setCustomWindow(null);
      setRangeIssue(clampIssue);
      return;
    }
    const issue = chartDateIssue(start, end, today);
    if (issue === "end-before-start") {
      setRangeIssue(issue);
      return;
    }
    setRangeIssue(clampIssue);
    setCustomWindow({ start, end });
  }

  function onStartDate(raw: string) {
    if (!today) return;
    const clamped = clampChartDate(raw, today);
    setStartDate(clamped.value);
    applyDates(clamped.value, endDate, clamped.issue);
  }

  function onEndDate(raw: string) {
    if (!today) return;
    const clamped = clampChartDate(raw, today);
    setEndDate(clamped.value);
    applyDates(startDate, clamped.value, clamped.issue);
  }

  function onPresetChange(value: string) {
    if (!isPresetDays(value)) return;
    setPreset(value);
    setCustomWindow(null);
    setStartDate("");
    setEndDate("");
    setRangeIssue(null);
  }

  const strokeColor = isPositiveChange
    ? "hsl(var(--chart-positive))"
    : "hsl(var(--chart-negative))";
  const fillColorId = isPositiveChange ? "fillPositive" : "fillNegative";
  const showSkeleton = isLoading && loadedRange !== fetchDays;
  const delayLabel = quoteDelayLabel(quoteStatus);
  const summary =
    customWindow && loadedRange !== fetchDays && isLoading
      ? "Loading price history…"
      : shown.length === 0
        ? data.length === 0
          ? "Chart unavailable"
          : "No prices in that date range"
        : `${isPositiveChange ? "Increased" : "Decreased"} by $${priceChange.value.toFixed(2)} (${priceChange.percent.toFixed(2)}%)`;
  const minDate = today ? chartHistoryStart(today) : undefined;
  const rangeMessage = rangeIssue ? chartDateMessage(rangeIssue) : null;

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-4 space-y-0 border-b py-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="grid flex-1 gap-1">
          <CardTitle className="flex items-center gap-2">
            Bitcoin Price
            {delayLabel ? <Badge variant="outline">{delayLabel}</Badge> : null}
          </CardTitle>
          <CardDescription>{summary}</CardDescription>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label
                htmlFor="btc-chart-start"
                className="text-xs text-muted-foreground"
              >
                Start date
              </Label>
              <Input
                id="btc-chart-start"
                type="date"
                value={startDate}
                min={minDate}
                max={today ?? undefined}
                onChange={(event) => onStartDate(event.target.value)}
                aria-invalid={rangeIssue === "end-before-start" ? true : undefined}
                aria-describedby={rangeMessage ? "btc-chart-range-error" : undefined}
                className="w-[10.5rem] dark:[color-scheme:dark]"
              />
            </div>
            <div className="grid gap-1">
              <Label
                htmlFor="btc-chart-end"
                className="text-xs text-muted-foreground"
              >
                End date
              </Label>
              <Input
                id="btc-chart-end"
                type="date"
                value={endDate}
                min={minDate}
                max={today ?? undefined}
                onChange={(event) => onEndDate(event.target.value)}
                aria-invalid={rangeIssue === "end-before-start" ? true : undefined}
                aria-describedby={rangeMessage ? "btc-chart-range-error" : undefined}
                className="w-[10.5rem] dark:[color-scheme:dark]"
              />
            </div>
            <Select
              value={customWindow ? CUSTOM_RANGE : preset}
              onValueChange={onPresetChange}
            >
              <SelectTrigger
                className="w-[160px] rounded-lg sm:ml-auto"
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
                <SelectItem value={CUSTOM_RANGE} disabled className="rounded-lg">
                  Custom range
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rangeMessage ? (
            <p id="btc-chart-range-error" role="alert" className="text-xs text-destructive">
              {rangeMessage}
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {showSkeleton ? (
          <Skeleton className="h-[250px] w-full" />
        ) : shown.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            {summary}
          </div>
        ) : (
          <ChartContainer config={{}} className="aspect-auto h-[250px] w-full">
            <AreaChart data={shown}>
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
