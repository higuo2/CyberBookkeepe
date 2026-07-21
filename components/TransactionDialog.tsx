"use client";

import type { FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  LoaderCircle,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  categoriesForType,
  defaultCategory,
  validateDraft,
} from "@/lib/transaction-utils";
import type { TransactionDraft } from "@/lib/types";

const fieldClass =
  "h-11 w-full rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] px-3 text-sm text-[#5C4A32] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15";

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
}) {
  if (!open) return null;

  const categories = categoriesForType(value.type);
  const locked = busy || deleting;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateDraft(value);
    if (validationError) {
      toast.error(validationError);
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
      <section className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[2rem] border border-[#EFE5D3] bg-[#FAF6EC] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-sm touch-pan-y sm:rounded-[2rem] sm:pb-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#F8A055]">
              钱包小猫
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#5C4A32]">{title}</h2>
          </div>
          <button
            aria-label="关闭"
            className="grid size-10 place-items-center rounded-full bg-white text-[#8A7A5C] shadow-sm transition-all active:scale-95"
            disabled={locked}
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <span className="mb-2 block text-xs font-medium text-[#9A7B55]">
              收支类型
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF6D9] p-1.5">
              {(["EXPENSE", "INCOME"] as const).map((type) => {
                const active = value.type === type;
                const expense = type === "EXPENSE";
                return (
                  <button
                    className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                      active
                        ? expense
                          ? "bg-white text-[#E07A3D] shadow-sm"
                          : "bg-white text-[#2A9D8F] shadow-sm"
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
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                    {expense ? "支出" : "收入"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-[#9A7B55]">
              金额（HK$）
              <input
                className={`${fieldClass} mt-2`}
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
              日期
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
          </div>

          <label className="block text-xs font-medium text-[#9A7B55]">
            分类
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
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-[#9A7B55]">
            备注（选填，空则用分类名）
            <textarea
              className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] p-3 text-sm text-[#5C4A32] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15"
              maxLength={200}
              onChange={(event) =>
                onChange({ ...value, note: event.target.value })
              }
              placeholder="可选：补充这笔账的详情"
              value={value.note}
            />
          </label>

          <div className="flex flex-col gap-2 pt-1">
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A055] font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
              disabled={locked}
              type="submit"
            >
              {busy ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Save className="size-5" />
              )}
              {busy ? "正在保存…" : submitLabel}
            </button>

            {onDelete && (
              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FFE8E0] text-sm font-semibold text-[#E07A3D] transition-all active:scale-95 disabled:opacity-50"
                disabled={locked}
                onClick={() => void onDelete()}
                type="button"
              >
                {deleting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {deleting ? "正在删除…" : "删除账单"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
