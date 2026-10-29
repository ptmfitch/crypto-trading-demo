"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  priceFeedError,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import { CircleAlert } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BtcQuoteState = {
  usd: number | null;
  status: BtcQuoteStatus;
  fetchedAt: number | null;
};

type BtcQuoteContextValue = BtcQuoteState;

const BtcQuoteContext = createContext<BtcQuoteContextValue | null>(null);

function isQuoteStatus(value: unknown): value is BtcQuoteStatus {
  return value === "fresh" || value === "stale" || value === "unavailable";
}

export function BtcQuoteProvider({
  initialQuote,
  children,
}: {
  initialQuote: BtcQuoteState;
  children: ReactNode;
}) {
  const [quote, setQuote] = useState<BtcQuoteState>(initialQuote);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/btc-price", {
          cache: "no-store",
          signal: AbortSignal.timeout(9_000),
        });
        const data = await response.json();
        const usd = data?.bitcoin?.usd;
        const status = data?.quote?.status;
        const fetchedAtRaw = data?.quote?.fetchedAt;
        const fetchedAt =
          typeof fetchedAtRaw === "string"
            ? Date.parse(fetchedAtRaw)
            : typeof fetchedAtRaw === "number"
              ? fetchedAtRaw
              : null;

        if (isQuoteStatus(status)) {
          setQuote((current) => {
            const nextUsd =
              status === "unavailable"
                ? null
                : typeof usd === "number" && usd > 0
                  ? usd
                  : current.usd;
            const nextFetchedAt =
              fetchedAt != null && Number.isFinite(fetchedAt)
                ? fetchedAt
                : current.fetchedAt;
            return {
              usd: nextUsd,
              status,
              fetchedAt: status === "unavailable" ? null : nextFetchedAt,
            };
          });
          return;
        }
        if (typeof usd === "number" && usd > 0) {
          setQuote({
            usd,
            status: "fresh",
            fetchedAt: Date.now(),
          });
          return;
        }
        setQuote((current) => ({
          ...current,
          status: current.status === "fresh" ? "stale" : current.status,
        }));
      } catch (error) {
        console.error("Client-side error fetching BTC price:", error);
        setQuote((current) => ({
          ...current,
          status:
            current.status === "unavailable" ? "unavailable" : "stale",
        }));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const value = useMemo(() => quote, [quote]);

  return (
    <BtcQuoteContext.Provider value={value}>{children}</BtcQuoteContext.Provider>
  );
}

export function useBtcQuote(): BtcQuoteContextValue {
  const context = useContext(BtcQuoteContext);
  if (!context) {
    throw new Error("useBtcQuote must be used within BtcQuoteProvider");
  }
  return context;
}

export function PriceFeedBanner() {
  const { status, fetchedAt } = useBtcQuote();
  const message = priceFeedError(status, fetchedAt);
  if (!message) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <CircleAlert />
      <AlertTitle>{message.title}</AlertTitle>
      <AlertDescription>{message.body}</AlertDescription>
    </Alert>
  );
}
