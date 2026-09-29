"use client";

import { useEffect, useState } from "react";
import { DollarSign, ListChecks, PoundSterling, TrendingUp, Wallet } from "lucide-react";

import { StatCard } from "@/components/StatCard";
import { Toggle } from "@/components/ui/toggle";

const SHOW_GBP_STORAGE_KEY = "tradesim-show-gbp";

interface DashboardStatsProps {
  portfolioValue: string;
  portfolioGbp: string | null;
  portfolioDescription?: string;
  pnlValue: string;
  pnlGbp: string | null;
  pnlColor: string;
  pnlDescription?: string;
  priceValue: string;
  priceGbp: string | null;
  priceColor?: string;
  priceDescription?: string;
  tradeCount: string;
  gbpAvailable: boolean;
}

export function DashboardStats({
  portfolioValue,
  portfolioGbp,
  portfolioDescription,
  pnlValue,
  pnlGbp,
  pnlColor,
  pnlDescription,
  priceValue,
  priceGbp,
  priceColor,
  priceDescription,
  tradeCount,
  gbpAvailable,
}: DashboardStatsProps) {
  const [showGbp, setShowGbp] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SHOW_GBP_STORAGE_KEY);
    if (stored === "true") setShowGbp(true);
    setHydrated(true);
  }, []);

  function handleToggle(next: boolean) {
    setShowGbp(next);
    localStorage.setItem(SHOW_GBP_STORAGE_KEY, String(next));
  }

  const gbpSecondary = (value: string | null) =>
    showGbp && gbpAvailable && value ? value : undefined;

  return (
    <div className="mb-6">
      <div className="mb-3 flex justify-end">
        <Toggle
          variant="outline"
          size="sm"
          pressed={showGbp}
          onPressedChange={handleToggle}
          disabled={!gbpAvailable}
          aria-label="Show GBP equivalents"
        >
          <PoundSterling className="h-4 w-4" />
          Show GBP
        </Toggle>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Portfolio Value"
          value={portfolioValue}
          icon={Wallet}
          secondary={hydrated ? gbpSecondary(portfolioGbp) : undefined}
          description={portfolioDescription}
        />
        <StatCard
          title="Total P&L"
          value={pnlValue}
          icon={TrendingUp}
          secondary={hydrated ? gbpSecondary(pnlGbp) : undefined}
          color={pnlColor}
          href="/profile"
          description={pnlDescription}
        />
        <StatCard
          title="Live BTC Price"
          value={priceValue}
          icon={DollarSign}
          secondary={hydrated ? gbpSecondary(priceGbp) : undefined}
          color={priceColor}
          description={priceDescription}
        />
        <StatCard
          title="Total Trades"
          value={tradeCount}
          icon={ListChecks}
          href="/profile"
        />
      </div>
    </div>
  );
}
