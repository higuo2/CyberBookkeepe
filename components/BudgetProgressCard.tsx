"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, Lightbulb, LoaderCircle, Lock, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { budgetBarColor } from "@/lib/budget";
import {
  writeBudgetSpendMode,
  type BudgetSpendMode,
} from "@/lib/planner";
import { formatHKD, writeBudgetToStorage } from "@/lib/transaction-utils";
import type { MonthBudgetStats } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";

function formatDailyAvailable(amount: number, t: ReturnType<typeof useT>) {
  const daily = Math.max(0, Math.round(amount));
  return t("budget.perDay", { amount: `HK$${daily.toLocaleString("en-US")}` });
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
  const remainingClass = overspent ? "text-danger" : "text-[#8C6D53]";

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
      <section className="rounded-2xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-[#4A3E3D]">{t("budget.title")}</h2>
          <button
            aria-label={t("budget.aria.edit")}
            className="grid size-8 place-items-center rounded-full text-[#A08875] transition-all duration-150 hover:bg-[#FFF6D9] active:scale-[0.98]"
            onClick={openEditor}
            type="button"
          >
            <Pencil className="size-3.5" strokeWidth={2} />
          </button>
        </div>

        {stats.budget <= 0 ? (
          <p className="mt-3 text-sm text-[#A08875]">
            {t("budget.empty")}
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#FFF6D9] p-1">
              <button
                className={`h-8 rounded-xl text-[11px] font-bold transition-all duration-150 active:scale-[0.98] ${
                  stats.spendMode === "actual"
                    ? "bg-white text-[#4A3E3D] shadow-sm"
                    : "text-[#A08875]"
                }`}
                onClick={() => setMode("actual")}
                type="button"
              >
                {t("budget.mode.spentOnly")}
              </button>
              <button
                className={`h-8 rounded-xl text-[11px] font-bold transition-all duration-150 active:scale-[0.98] ${
                  stats.spendMode === "reserve_fixed"
                    ? "bg-white text-[#4A3E3D] shadow-sm"
                    : "text-[#A08875]"
                }`}
                onClick={() => setMode("reserve_fixed")}
                type="button"
              >
                {t("budget.mode.withFixed")}
              </button>
            </div>
            <p className="mt-2 flex items-start gap-1 text-[11px] leading-4 text-[#A08875]">
              {stats.spendMode === "actual" ? (
                <>
                  <Lightbulb
                    className="mt-px size-3.5 shrink-0"
                    strokeWidth={2}
                  />
                  {t("budget.hint.spentOnly")}
                </>
              ) : (
                <>
                  <Lock className="mt-px size-3.5 shrink-0" strokeWidth={2} />
                  {t("budget.hint.withFixed")}
                </>
              )}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-[#FFF6D9] p-2.5">
                <p className="text-[10px] font-medium text-[#A08875]">{t("budget.used")}</p>
                <p className="mt-1 font-numeric text-sm font-semibold text-[#4A3E31]">
                  {formatHKD(stats.spent)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#FFF6D9] p-2.5">
                <p className="text-[10px] font-medium text-[#A08875]">{t("budget.remaining")}</p>
                <p className={`mt-1 font-numeric text-sm font-semibold ${remainingClass}`}>
                  {formatHKD(stats.remaining)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#FFF6D9] p-2.5">
                <p className="text-[10px] font-medium text-[#A08875]">{t("budget.dailyAvailable")}</p>
                <p className="mt-1 font-numeric text-sm font-semibold text-[#4A3E31]">
                  {formatDailyAvailable(stats.dailyAvailable, t)}
                </p>
              </div>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#FFF6D9]">
              <div
                className={`h-full rounded-full transition-all ${budgetBarColor(stats.ratio)}`}
                style={{ width }}
              />
            </div>
            <p className="mt-1.5 font-numeric text-xs text-[#A08875]">
              {t("budget.summary", {
                budget: formatHKD(stats.budget),
                used: `${(stats.ratio * 100).toFixed(0)}%`,
              })}
              {stats.spendMode === "reserve_fixed" && stats.estimatedFixed > 0
                ? t("budget.reservedFixed", { amount: formatHKD(stats.estimatedFixed) })
                : ""}
            </p>
            {overspent && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
                {t("budget.overspent")}
              </p>
            )}
          </>
        )}
      </section>

      <BottomSheet onOpenChange={setOpen} open={open} title={t("budget.editTitle")}>
        <form className="space-y-4 pt-1" onSubmit={saveBudget}>
          <label className="block text-xs font-medium text-[#A08875]">
            {t("budget.totalLabel")}
            <input
              autoFocus
              className="mt-2 h-12 w-full rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] px-3 text-sm text-[#4A3E3D] outline-none transition-all focus:border-[#EE7828] focus:ring-4 focus:ring-[#EE7828]/15"
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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#EE7828] font-bold text-white shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
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
