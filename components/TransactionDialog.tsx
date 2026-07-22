"use client";

import type { FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Lightbulb,
  LoaderCircle,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  categoriesForType,
  categoryLabel,
  defaultCategory,
  validateDraft,
} from "@/lib/transaction-utils";
import {
  CURRENCY_CODES,
  CURRENCY_META,
  normalizeCurrency,
} from "@/lib/currency";
import type { TransactionDraft } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";

const fieldClass =
  "h-11 w-full rounded-2xl border border-[#EAE5D9] bg-[#F0ECE1] px-3 text-sm text-[#5C4A32] outline-none transition-all focus:border-[#C86235] focus:ring-4 focus:ring-[#C86235]/15";

export function TransactionDialog({
  open,
  title,
  submitLabel,
  value,
  busy,
  onChange,
  onClose,
  onSubmit,
  onDelete,
  deleting = false,
  isRecurring = false,
  onManageRecurring,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  value: TransactionDraft;
  busy: boolean;
  onChange: (value: TransactionDraft) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onDelete?: () => Promise<void>;
  deleting?: boolean;
  /** 周期规则自动生成的账单 */
  isRecurring?: boolean;
  onManageRecurring?: () => void;
}) {
  const t = useT();
  if (!open) return null;

  const categories = categoriesForType(value.type);
  const locked = busy || deleting;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateDraft(value);
    if (validationError) {
      toast.error(t(validationError));
      return;
    }
    await onSubmit();
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-x-hidden bg-[#5C4A32]/25 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
    >
      <section className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-[#EAE5D9] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-2xs touch-pan-y sm:rounded-3xl sm:pb-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9C9285]">
              {t("auth.brand")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#5C4A32]">{title}</h2>
          </div>
          <button
            aria-label={t("common.close")}
            className="grid size-10 place-items-center rounded-full bg-white text-[#8A7A5C] shadow-sm transition-all duration-150 active:scale-[0.98]"
            disabled={locked}
            onClick={onClose}
            type="button"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </header>

        {isRecurring && (
          <div className="mt-4 rounded-2xl bg-[#F0ECE1] px-3.5 py-3">
            <p className="flex items-start gap-1.5 text-sm leading-5 text-[#8C6D53]">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
              {t("dialog.recurringGenerated")}
            </p>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <span className="mb-2 block text-xs font-medium text-[#9A7B55]">
              {t("dialog.type")}
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F0ECE1] p-1.5">
              {(["EXPENSE", "INCOME"] as const).map((type) => {
                const active = value.type === type;
                const expense = type === "EXPENSE";
                return (
                  <button
                    className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                      active
                        ? expense
                          ? "bg-white text-[#B8785C] shadow-sm"
                          : "bg-white text-[#5B7A66] shadow-sm"
                        : "text-[#A08B68]"
                    }`}
                    key={type}
                    onClick={() =>
                      onChange({
                        ...value,
                        type,
                        category: categoriesForType(type).includes(
                          value.category as never,
                        )
                          ? value.category
                          : defaultCategory(type),
                      })
                    }
                    type="button"
                  >
                    {expense ? (
                      <ArrowDownLeft className="size-4" strokeWidth={2} />
                    ) : (
                      <ArrowUpRight className="size-4" strokeWidth={2} />
                    )}
                    {expense ? t("common.expense") : t("common.income")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-[#9A7B55]">
              {t("dialog.amount")}
              <input
                className={`${fieldClass} mt-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                inputMode="decimal"
                min="0.01"
                onChange={(event) =>
                  onChange({ ...value, amount: Number(event.target.value) })
                }
                placeholder="0.00"
                required
                step="0.01"
                type="number"
                value={value.amount || ""}
              />
            </label>
            <label className="text-xs font-medium text-[#9A7B55]">
              {t("dialog.currency")}
              <select
                className={`${fieldClass} mt-2`}
                onChange={(event) =>
                  onChange({
                    ...value,
                    currency: normalizeCurrency(event.target.value),
                  })
                }
                value={normalizeCurrency(value.currency)}
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code} ({CURRENCY_META[code].symbol})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-medium text-[#9A7B55]">
            {t("dialog.date")}
            <input
              className={`${fieldClass} mt-2`}
              onChange={(event) =>
                onChange({ ...value, date: event.target.value })
              }
              required
              type="date"
              value={value.date}
            />
          </label>

          <label className="block text-xs font-medium text-[#9A7B55]">
            {t("dialog.category")}
            <select
              className={`${fieldClass} mt-2`}
              onChange={(event) =>
                onChange({ ...value, category: event.target.value })
              }
              required
              value={value.category}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category, t)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-[#9A7B55]">
            {t("dialog.noteOptional")}
            <textarea
              className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-[#EAE5D9] bg-[#F0ECE1] p-3 text-sm text-[#5C4A32] outline-none transition-all focus:border-[#C86235] focus:ring-4 focus:ring-[#C86235]/15"
              maxLength={200}
              onChange={(event) =>
                onChange({ ...value, note: event.target.value })
              }
              placeholder={t("dialog.notePlaceholder")}
              value={value.note}
            />
          </label>

          <div className="flex flex-col gap-2 pt-1">
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C86235] font-semibold text-white shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
              disabled={locked}
              type="submit"
            >
              {busy ? (
                <LoaderCircle className="size-5 animate-spin" strokeWidth={2.25} />
              ) : (
                <Save className="size-5" strokeWidth={2.25} />
              )}
              {busy ? t("dialog.saving") : submitLabel}
            </button>

            {onDelete && (
              <div className="flex flex-col gap-2">
                <button
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#EFEAE8] text-sm font-semibold text-[#B8785C] transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                  disabled={locked}
                  onClick={() => void onDelete()}
                  type="button"
                >
                  {deleting ? (
                    <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <Trash2 className="size-4" strokeWidth={2} />
                  )}
                  {deleting ? t("dialog.deleting") : t("dialog.deleteBill")}
                </button>
                {isRecurring && onManageRecurring && (
                  <button
                    className="w-full py-1.5 text-center text-xs font-bold text-[#B37233] transition-opacity active:opacity-70"
                    disabled={locked}
                    onClick={onManageRecurring}
                    type="button"
                  >
                    ⚙️ {t("dialog.manageRule")}
                  </button>
                )}
              </div>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
