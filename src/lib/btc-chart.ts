export const btcChartRanges = [
  { label: "Last 7 Days", value: "7" },
  { label: "Last 30 Days", value: "30" },
  { label: "Last 3 Months", value: "90" },
  { label: "Last Year", value: "365" },
] as const;

export function btcChartRangeLabel(value: string) {
  return (
    btcChartRanges.find((option) => option.value === value)?.label ??
    "Last 30 Days"
  );
}

export function bitcoinChartName(rangeLabel: string) {
  return `Bitcoin price, ${rangeLabel.toLowerCase()}`;
}

/** Visible range text has to stay inside the combobox name (WCAG 2.5.3). */
export function chartRangeName(rangeLabel: string) {
  return `Chart range, ${rangeLabel}`;
}

/**
 * Axis labels are thousands of dollars (`$82.9k`), the same scale as the live quote.
 * Dividing by 100 paints a price about ten times too high.
 */
export function formatBtcAxisTick(value: number) {
  return `$${(Number(value) / 1000).toFixed(1)}k`;
}

export function formatChartDate(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatChartPrice(value: number) {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
