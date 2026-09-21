"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  ASSET_IDS,
  ASSETS,
  assetMatchesQuery,
  coinIconSrc,
  type AssetId,
} from "@/lib/assets";
import type { BtcQuoteStatus } from "@/lib/btc-quote";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type PickerQuote = {
  usd: number | null;
  usd24hChange: number | null;
  status: BtcQuoteStatus;
};

function formatPrice(usd: number | null) {
  if (usd == null) return "—";
  return `$${usd.toLocaleString(undefined, {
    minimumFractionDigits: usd >= 1 ? 2 : 4,
    maximumFractionDigits: usd >= 1 ? 2 : 4,
  })}`;
}

function formatChange(change: number | null) {
  if (change == null || !Number.isFinite(change)) return "—";
  const text = `${Math.abs(change).toFixed(1)}%`;
  return change >= 0 ? `+${text}` : `-${text}`;
}

export function CoinPicker({
  assetId,
  quotes,
  onAssetId,
}: {
  assetId: AssetId;
  quotes: Record<AssetId, PickerQuote>;
  onAssetId: (assetId: AssetId) => void;
}) {
  const asset = ASSETS[assetId];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const rows = ASSET_IDS.filter((id) => assetMatchesQuery(ASSETS[id], query));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-white/[0.12] bg-[#343434] px-3 py-2.5"
          aria-label={`Select asset, ${asset.name}`}
        >
          <span className="flex items-center gap-2">
            <Image
              src={coinIconSrc(assetId)}
              alt=""
              width={22}
              height={22}
              unoptimized
            />
            <span className="text-sm font-semibold text-[#fbfbfb]">
              {asset.symbol}
            </span>
            <span className="text-xs text-[#b5b5b5]">{asset.name}</span>
          </span>
          <ChevronDown className="size-3.5 text-[#b5b5b5]" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="border-white/10 bg-[#252525] px-5 pt-12 pb-6 text-[#fbfbfb]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 rounded-xl border border-white/10 bg-[#343434] p-3.5">
          <SheetTitle className="text-sm font-semibold text-[#fbfbfb]">
            Select asset
          </SheetTitle>
          <SheetDescription className="sr-only">
            Search Bitcoin, Ethereum, or Solana. Prices are quoted in USDT.
          </SheetDescription>
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or symbol…"
            className="h-auto border-white/[0.08] bg-[#454545] px-3 py-2.5 text-[13px] text-[#fbfbfb] placeholder:text-[#b5b5b5]"
          />
          {rows.length === 0 ? (
            <p className="px-2.5 py-4 text-center text-[13px] text-[#b5b5b5]">
              No assets match
            </p>
          ) : (
            rows.map((id) => {
              const row = ASSETS[id];
              const quote = quotes[id];
              const selected = id === assetId;
              const change = quote?.usd24hChange ?? null;
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`${row.symbol} ${row.name}`}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg p-2.5 text-left",
                    selected && "bg-[#454545]"
                  )}
                  onClick={() => {
                    onAssetId(id);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2.5">
                    <Image
                      src={coinIconSrc(id)}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-semibold text-[#fbfbfb]">
                        {row.symbol}
                      </span>
                      <span className="text-[11px] text-[#b5b5b5]">
                        {row.name}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="text-xs font-semibold text-[#fbfbfb]">
                      {formatPrice(quote?.usd ?? null)}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        change == null
                          ? "text-[#b5b5b5]"
                          : change >= 0
                            ? "text-[#22c55e]"
                            : "text-[#f04545]"
                      )}
                    >
                      {formatChange(change)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
