"use client";

import { cancelPriceAlert, createPriceAlert } from "@/actions/price-alert";
import { usePriceAlertTick } from "@/components/PriceAlertTick";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  priceAlertRowLabel,
  type ActivePriceAlert,
  type AlertDirection,
} from "@/lib/price-alert";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

export function PriceAlerts({ alerts }: { alerts: ActivePriceAlert[] }) {
  const router = useRouter();
  const tickNow = usePriceAlertTick();
  const [direction, setDirection] = useState<AlertDirection>("ABOVE");
  const [threshold, setThreshold] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const thresholdUsd = Number(threshold);
    startTransition(async () => {
      const result = await createPriceAlert({
        assetId: "bitcoin",
        direction,
        thresholdUsd,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setThreshold("");
      await tickNow();
      router.refresh();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await cancelPriceAlert(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mb-8 grid max-w-md gap-4">
      <Card>
        <CardHeader>
          <CardTitle>New price alert</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Asset</Label>
              <div className="flex items-center justify-center gap-2 rounded-md bg-muted px-3 py-3 text-sm font-medium">
                <span className="size-2.5 rounded-full bg-orange-500" />
                BTC · Bitcoin (v1 locked)
              </div>
            </div>

            <div className="space-y-2">
              <Label>Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["ABOVE", "Above"],
                    ["BELOW", "Below"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={direction === value ? "default" : "outline"}
                    className="h-11"
                    aria-pressed={direction === value}
                    onClick={() => setDirection(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert-threshold">Threshold (USD)</Label>
              <div className="relative">
                <Input
                  id="alert-threshold"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  className="h-11 pr-14 text-lg"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
                  USD
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-green-500 font-semibold text-black hover:bg-green-600"
              disabled={isPending}
            >
              Set alert
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts yet.</p>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-3">
                  <span className="text-sm text-muted-foreground">
                    {priceAlertRowLabel(alert.direction, alert.thresholdUsd)}
                  </span>
                  <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  One-shot · fires toast once on cross
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-background"
                  disabled={isPending}
                  onClick={() => onDelete(alert.id)}
                >
                  Delete
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
