"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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

export function BtcPriceChart() {
  const [data, setData] = React.useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState("30");

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/btc-chart?days=${timeRange}`);
        const chartData = await response.json();
        setData(chartData);
      } catch (error) {
        console.error("Failed to fetch chart data", error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [timeRange]);

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

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-4 space-y-0 border-b py-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="grid flex-1 gap-1">
          <CardTitle>Bitcoin Price</CardTitle>
          <CardDescription>
            {isPositiveChange ? "Increased" : "Decreased"} by $
            {priceChange.value.toFixed(2)} ({priceChange.percent.toFixed(2)}%)
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
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
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <Skeleton className="h-[250px] w-full" />
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
                  })
                }
              />
              <YAxis
                domain={chartDomain}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) =>
                  `$${(Number(value) / 1000).toFixed(1)}k`
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
