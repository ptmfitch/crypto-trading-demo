"use client";

import {
  cancelRecurringPlan,
  createRecurringPlan,
  pauseRecurringPlan,
  resumeRecurringPlan,
  tickRecurringPlans,
} from "@/actions/recurring";
import {
  ASSET_NAME,
  ASSET_SYMBOL,
  cadenceLabel,
  formatNextRunLabel,
  pausedDetail,
  planTitle,
  RECURRING_ASSETS,
  type RecurringAssetId,
  type RecurringCadence,
  type RecurringPlanView,
} from "@/lib/recurring";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  type FormEvent,
  useEffect,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

const CHIPS = [50, 100, 250] as const;
const POLL_MS = 15_000;
const DOT: Record<RecurringAssetId, string> = {
  bitcoin: "#f7931a",
  ethereum: "#627eea",
  solana: "#14f195",
};

const seenToasts = new Set<string>();

function announceFills(toastId: string | null, messages: string[]) {
  if (!toastId || messages.length === 0 || seenToasts.has(toastId)) return;
  seenToasts.add(toastId);
  for (const message of messages) toast(message);
}

export function RecurringFillToast({
  toastId,
  messages,
}: {
  toastId: string | null;
  messages: string[];
}) {
  useEffect(() => {
    announceFills(toastId, messages);
  }, [toastId, messages]);
  return null;
}

function parseAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function RecurringPlans({
  plans,
  toastId,
  fills,
}: {
  plans: RecurringPlanView[];
  toastId: string | null;
  fills: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState<RecurringAssetId>("bitcoin");
  const [amount, setAmount] = useState("50.00");
  const [cadence, setCadence] = useState<RecurringCadence>("WEEKLY");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const parsed = parseAmount(amount);

  useEffect(() => {
    announceFills(toastId, fills);
  }, [toastId, fills]);

  useEffect(() => {
    let stopped = false;
    const id = setInterval(() => {
      void tickRecurringPlans().then((result) => {
        if (stopped) return;
        announceFills(result.toastId, result.fills);
        if (result.changed) router.refresh();
      });
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openSheet() {
    setAssetId("bitcoin");
    setAmount("50.00");
    setCadence("WEEKLY");
    setOpen(true);
  }

  function onCreate(event: FormEvent) {
    event.preventDefault();
    if (parsed == null) return;
    startTransition(async () => {
      const result = await createRecurringPlan({
        assetId,
        quoteAmount: parsed,
        cadence,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(result.message);
      router.refresh();
    });
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Plan update failed");
        return;
      }
      setConfirmingId(null);
      router.refresh();
    });
  }

  return (
    <section className="mb-8 max-w-[400px]">
      <div className="flex flex-col gap-2.5 rounded-[10px] border border-white/10 bg-[#343434] p-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#fbfbfb]">Active plans</h2>
          {plans.length > 0 ? (
            <button
              type="button"
              onClick={openSheet}
              className="text-xs font-semibold text-[#fbfbfb]"
            >
              Create a plan
            </button>
          ) : null}
        </div>

        {plans.length === 0 ? (
          <p className="text-xs text-[#b5b5b5]">
            No recurring plans yet.{" "}
            <button
              type="button"
              onClick={openSheet}
              className="font-semibold text-[#fbfbfb]"
            >
              Create a plan
            </button>
          </p>
        ) : (
          plans.map((plan) => {
            const confirming = confirmingId === plan.id;
            return (
              <article
                key={plan.id}
                className="flex flex-col gap-2 rounded-[8px] bg-[#454545] p-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#fbfbfb]">
                    {planTitle(plan)}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] font-semibold",
                      plan.status === "ACTIVE"
                        ? "bg-[#22c55e]/20 text-[#22c55e]"
                        : "bg-[#f2b833]/20 text-[#f2b833]",
                    )}
                  >
                    {plan.status === "ACTIVE" ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="text-[11px] text-[#b5b5b5]">
                  {plan.status === "ACTIVE"
                    ? `Next run · ${formatNextRunLabel(new Date(plan.nextRunAt))}`
                    : pausedDetail(
                        plan.lastRunAt ? new Date(plan.lastRunAt) : null,
                        new Date(),
                      )}
                </p>
                <div className="flex gap-2">
                  {confirming ? (
                    <>
                      <RowButton
                        disabled={pending}
                        onClick={() => setConfirmingId(null)}
                      >
                        Keep
                      </RowButton>
                      <RowButton
                        disabled={pending}
                        onClick={() => run(() => cancelRecurringPlan(plan.id))}
                      >
                        Confirm cancel
                      </RowButton>
                    </>
                  ) : (
                    <>
                      <RowButton
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            plan.status === "ACTIVE"
                              ? pauseRecurringPlan(plan.id)
                              : resumeRecurringPlan(plan.id),
                          )
                        }
                      >
                        {plan.status === "ACTIVE" ? "Pause" : "Resume"}
                      </RowButton>
                      <RowButton
                        disabled={pending}
                        onClick={() => setConfirmingId(plan.id)}
                      >
                        Cancel
                      </RowButton>
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-recurring-buy"
            onClick={(event) => event.stopPropagation()}
            onSubmit={onCreate}
            className="flex w-full max-w-[380px] flex-col gap-2.5 rounded-[10px] border border-white/10 bg-[#343434] p-3.5"
          >
            <div className="flex items-center justify-between">
              <h2
                id="new-recurring-buy"
                className="text-sm font-semibold text-[#fbfbfb]"
              >
                New recurring buy
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-[#b5b5b5]"
              >
                Close
              </button>
            </div>

            <label className="text-xs font-medium text-[#b5b5b5]" htmlFor="recurring-asset">
              Asset
            </label>
            <div className="flex items-center gap-2 rounded-[8px] bg-[#454545] px-3 py-2.5">
              <span
                aria-hidden
                className="size-5 shrink-0 rounded-full"
                style={{ backgroundColor: DOT[assetId] }}
              />
              <select
                id="recurring-asset"
                value={assetId}
                onChange={(event) =>
                  setAssetId(event.target.value as RecurringAssetId)
                }
                className="w-full bg-transparent text-[13px] font-semibold text-[#fbfbfb] outline-none"
              >
                {RECURRING_ASSETS.map((asset) => (
                  <option key={asset} value={asset}>
                    {ASSET_SYMBOL[asset]} · {ASSET_NAME[asset]}
                  </option>
                ))}
              </select>
            </div>

            <label
              className="text-xs font-medium text-[#b5b5b5]"
              htmlFor="recurring-amount"
            >
              Amount (USDT)
            </label>
            <div className="flex items-center justify-between rounded-[8px] bg-[#454545] px-3 py-2.5">
              <input
                id="recurring-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full bg-transparent text-base font-semibold text-[#fbfbfb] outline-none"
              />
              <span className="text-xs font-semibold text-[#b5b5b5]">USDT</span>
            </div>
            <div className="flex gap-2">
              {CHIPS.map((chip) => {
                const selected = parsed === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setAmount(chip.toFixed(2))}
                    className={cn(
                      "flex-1 rounded-[8px] py-2 text-xs font-semibold",
                      selected
                        ? "bg-[#fbfbfb] text-[#252525]"
                        : "border border-white/15 text-[#b5b5b5]",
                    )}
                  >
                    ${chip}
                  </button>
                );
              })}
            </div>

            <p className="text-xs font-medium text-[#b5b5b5]">Cadence</p>
            <div className="flex gap-1 rounded-[8px] bg-[#454545] p-1">
              {(["DAILY", "WEEKLY"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCadence(value)}
                  className={cn(
                    "flex-1 rounded-[6px] py-2 text-xs font-semibold",
                    cadence === value
                      ? "bg-[#343434] text-[#fbfbfb]"
                      : "text-[#b5b5b5]",
                  )}
                >
                  {cadenceLabel(value)}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={pending || parsed == null}
              className="rounded-[8px] bg-[#22c55e] py-3 text-sm font-semibold text-[#0a1f0f] disabled:opacity-60"
            >
              {pending ? "Starting…" : "Start plan"}
            </button>
            {parsed == null ? (
              <p role="alert" className="text-xs text-[#f2b833]">
                Enter an amount greater than 0.
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}

function RowButton({
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="flex-1 rounded-[6px] border border-white/15 py-1.5 text-[11px] font-medium text-[#b5b5b5] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
