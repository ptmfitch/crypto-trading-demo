"use client";

import { tickPriceAlerts } from "@/actions/price-alert";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const POLL_MS = 10_000;

export function usePriceAlertTick() {
  const router = useRouter();
  const running = useRef(false);
  const again = useRef(false);

  const tickNow = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        const result = await tickPriceAlerts();
        if (result.fired.length === 0) continue;
        for (const alert of result.fired) {
          toast(alert.message, { id: alert.id });
        }
        router.refresh();
      } while (again.current);
    } catch (error) {
      console.error("Price alert tick failed", error);
    } finally {
      running.current = false;
    }
  }, [router]);

  useEffect(() => {
    void tickNow();
    const id = setInterval(() => void tickNow(), POLL_MS);
    return () => clearInterval(id);
  }, [tickNow]);

  return tickNow;
}

export function PriceAlertTick() {
  usePriceAlertTick();
  return null;
}
