"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { localeToDateLocale, type Locale } from "@/i18n/config";
import { useMessages } from "@/i18n/locale-provider";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

export type PnlDataPoint = {
  date: string;
  pnl: number;
};

type PortfolioPnlChartProps = {
  data: PnlDataPoint[];
  locale: Locale;
};

export function PortfolioPnlChart({ data, locale }: PortfolioPnlChartProps) {
  const { messages } = useMessages();
  const dateLocale = localeToDateLocale(locale);

  const chartConfig = {
    pnl: {
      label: messages.profile.pnl,
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const isLoss = data.length > 0 && data[data.length - 1].pnl < 0;
  const strokeColor = isLoss
    ? "hsl(var(--destructive))"
    : "hsl(var(--chart-2))";
  const fillColorId = isLoss ? "fillRed" : "fillGreen";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.profile.portfolioPerformance}</CardTitle>
        <CardDescription>
          {messages.profile.portfolioPnlDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillGreen" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--chart-2))"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--chart-2))"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillRed" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--destructive))"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--destructive))"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke={`hsl(var(--muted-foreground), 0.5)`}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: `hsl(var(--muted-foreground))` }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString(dateLocale, {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: `hsl(var(--muted-foreground))` }}
              tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(label) =>
                    new Date(label).toLocaleDateString(dateLocale)
                  }
                  formatter={(value) => [
                    `$${Number(value).toLocaleString()}`,
                    messages.profile.pnl,
                  ]}
                />
              }
            />
            <ReferenceLine
              y={0}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
            />
            <Area
              dataKey="pnl"
              type="monotone"
              fill={`url(#${fillColorId})`}
              stroke={strokeColor}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
