"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  Info,
  LoaderCircle,
  Lock,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import {
  MetricLabel,
  MetricValue,
  PlannerCardHeader,
} from "@/components/ui/PlannerCardHeader";
import { budgetBarColor } from "@/lib/budget";
import {
  writeBudgetSpendMode,
  type BudgetSpendMode,
} from "@/lib/planner";
import { formatHKD, writeBudgetToStorage } from "@/lib/transaction-utils";
import type { MonthBudgetStats } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";
import { completeMilestone } from "@/lib/can-system";

function formatDailyAmount(amount: number) {
  const daily = Math.max(0, Math.round(amount));
  return `$${daily.toLocaleString("en-US")}`;
}

export function BudgetProgressCard({
  stats,
  onBudgetSaved,
  onSpendModeChange,
}: {
  stats: MonthBudgetStats;
  onBudgetSaved?: (budget: number) => void;
  onSpendModeChange?: (mode: BudgetSpendMode) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const width = useMemo(
    () => `${Math.min(100, Math.max(0, stats.ratio * 100)).toFixed(1)}%`,
    [stats.ratio],
  );
  const overspent = stats.budget > 0 && stats.ratio > 1;

  function openEditor() {
    setInput(stats.budget > 0 ? String(stats.budget) : "");
    setOpen(true);
  }

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error(t("toast.budgetInvalid"));
      return;
    }
    setSaving(true);
    try {
      writeBudgetToStorage(amount);
      onBudgetSaved?.(amount);
      setOpen(false);
      toast.success(t("toast.budgetUpdated"));
      if (amount > 0) {
        const m = completeMilestone("milestone_budget");
        if (m.awarded) toast.success(t("can.milestone.budget"));
      }
    } finally {
      setSaving(false);
    }
  }

  function setMode(mode: BudgetSpendMode) {
    writeBudgetSpendMode(mode);
    onSpendModeChange?.(mode);
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-2xs">
        <PlannerCardHeader
          action="pencil"
          actionAriaLabel={t("budget.aria.edit")}
          onAction={openEditor}
          title={t("budget.title")}
        />

        {stats.budget <= 0 ? (
          <p className="text-[13px] text-[var(--color-text-main)] opacity-60">{t("budget.empty")}</p>
        ) : (
          <>
            <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--color-bg-soft)] p-1">
              <button
                className={`h-8 rounded-xl text-[8px] font-bold transition-all duration-150 active:scale-[0.98] ${
                  stats.spendMode === "actual"
                    ? "bg-[var(--color-bg-card)] text-[var(--color-text-main)] shadow-sm"
                    : "text-[#8C8273]"
                }`}
                onClick={() => setMode("actual")}
                type="button"
              >
                {t("budget.mode.spentOnly")}
              </button>
              <button
                className={`h-8 rounded-xl text-[8px] font-bold transition-all duration-150 active:scale-[0.98] ${
                  stats.spendMode === "reserve_fixed"
                    ? "bg-[var(--color-bg-card)] text-[var(--color-text-main)] shadow-sm"
                    : "text-[#8C8273]"
                }`}
                onClick={() => setMode("reserve_fixed")}
                type="button"
              >
                {t("budget.mode.withFixed")}
              </button>
            </div>

            <p className="mt-2 flex items-start text-[12px] leading-4 text-[#8C8273]">
              {stats.spendMode === "actual" ? (
                <>
                  <Info
                    className="mr-1 mt-px inline size-3.5 shrink-0 text-[#A89F91]"
                    strokeWidth={2}
                  />
                  {t("budget.hint.spentOnly")}
                </>
              ) : (
                <>
                  <Lock
                    className="mr-1 mt-px inline size-3.5 shrink-0 text-[#A89F91]"
                    strokeWidth={2}
                  />
                  {t("budget.hint.withFixed")}
                </>
              )}
            </p>

            <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--color-border)] text-center">
              <div className="px-1.5">
                <MetricLabel>{t("budget.used")}</MetricLabel>
                <MetricValue>{formatHKD(stats.spent)}</MetricValue>
              </div>
              <div className="px-1.5">
                <MetricLabel>{t("budget.remaining")}</MetricLabel>
                <MetricValue
                  className={overspent ? "text-danger" : "text-[var(--color-text-main)]"}
                >
                  {formatHKD(stats.remaining)}
                </MetricValue>
              </div>
              <div className="px-1.5">
                <MetricLabel>{t("budget.dailyAvailable")}</MetricLabel>
                <MetricValue>
                  {formatDailyAmount(stats.dailyAvailable)}
                  <span className="text-[12px] font-normal text-[#8C8273]">
                    {t("budget.perDayUnit")}
                  </span>
                </MetricValue>
              </div>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--color-bg-soft)]">
              <div
                className={`h-full rounded-full transition-all ${budgetBarColor(stats.ratio)}`}
                style={{ width }}
              />
            </div>
            <p className="mt-2 font-numeric text-[12px] text-[#8C8273]">
              {t("budget.summary", {
                budget: formatHKD(stats.budget),
                used: `${(stats.ratio * 100).toFixed(0)}%`,
              })}
              {stats.spendMode === "reserve_fixed" && stats.estimatedFixed > 0
                ? t("budget.reservedFixed", {
                    amount: formatHKD(stats.estimatedFixed),
                  })
                : ""}
            </p>
            {overspent && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-danger">
                <AlertTriangle className="size-3.5 shrink-0" strokeWidth={2} />
                {t("budget.overspent")}
              </p>
            )}
          </>
        )}
      </section>

      <BottomSheet onOpenChange={setOpen} open={open} title={t("budget.editTitle")}>
        <form className="space-y-4 pt-1" onSubmit={saveBudget}>
          <label className="block text-xs font-medium text-[#8C8273]">
            {t("budget.totalLabel")}
            <input
              autoFocus
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 text-sm text-[var(--color-text-main)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/15"
              inputMode="decimal"
              min="0"
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("budget.placeholder")}
              step="1"
              type="number"
              value={input}
            />
          </label>
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary)] font-bold text-white shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
            disabled={saving}
            type="submit"
          >
            {saving ? (
              <LoaderCircle className="size-5 animate-spin" strokeWidth={2.25} />
            ) : (
              <Save className="size-5" strokeWidth={2.25} />
            )}
            {t("budget.save")}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}
