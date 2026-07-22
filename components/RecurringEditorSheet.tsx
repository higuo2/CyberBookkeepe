"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Lightbulb,
  Zap,
} from "lucide-react";
import { AppIcon, defaultRecurringIconId } from "@/components/AppIcons";
import { BottomSheet } from "@/components/BottomSheet";
import {
  RECURRING_EMOJIS,
  WEEKDAY_OPTIONS,
  WORKDAYS,
  nextByDaysDate,
  nextMonthlyDate,
  nextYearlyDate,
  type RecurrenceKind,
  type RecurringDirection,
  type WeekdayCode,
} from "@/lib/planner";
import { useT } from "@/components/LocaleProvider";

export type RecurringFormState = {
  name: string;
  amount: string;
  direction: RecurringDirection;
  kind: RecurrenceKind;
  dayOfMonth: string;
  /** 每年：月份 1–12 */
  monthOfYear: string;
  byDays: WeekdayCode[];
  endDate: string;
  remindDays: string;
  autoWrite: boolean;
  emoji: string;
};

export function emptyRecurringForm(): RecurringFormState {
  return {
    name: "",
    amount: "",
    direction: "expense",
    kind: "monthly",
    dayOfMonth: "10",
    monthOfYear: String(new Date().getMonth() + 1),
    byDays: [...WORKDAYS],
    endDate: "",
    remindDays: "3",
    autoWrite: true,
    emoji: "cloud",
  };
}

const numberFieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] px-3 text-sm text-[#4A3E3D] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const textFieldClass =
  "h-12 w-full rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] px-3 text-sm text-[#4A3E3D] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15";

const selectFieldClass =
  `${numberFieldClass} appearance-none bg-[length:14px_14px] bg-[right_14px_center] bg-no-repeat pr-10 ` +
  `bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23A08875' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")]`;

const dateFieldClass =
  "relative h-12 w-full cursor-pointer rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] px-3 pr-10 text-sm text-[#4A3E3D] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15 " +
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

export function computeFormNextDate(form: RecurringFormState): string {
  const day = Math.min(31, Math.max(1, Number(form.dayOfMonth) || 1));
  if (form.kind === "by_days") {
    return nextByDaysDate(form.byDays.length ? form.byDays : WORKDAYS);
  }
  if (form.kind === "yearly") {
    const monthIndex = Math.min(11, Math.max(0, (Number(form.monthOfYear) || 1) - 1));
    return nextYearlyDate(monthIndex, day);
  }
  return nextMonthlyDate(day);
}

export function RecurringEditorSheet({
  open,
  isNew,
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
  onDelete,
  onEarlyWrite,
  earlyWriting = false,
}: {
  open: boolean;
  isNew: boolean;
  form: RecurringFormState;
  onFormChange: (next: RecurringFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  onDelete?: () => void;
  onEarlyWrite?: () => void | Promise<void>;
  earlyWriting?: boolean;
}) {
  const t = useT();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const nextDateHint = useMemo(() => computeFormNextDate(form), [form]);

  function patch(partial: Partial<RecurringFormState>) {
    onFormChange({ ...form, ...partial });
  }

  function toggleWeekday(code: WeekdayCode) {
    const has = form.byDays.includes(code);
    const byDays = has
      ? form.byDays.filter((d) => d !== code)
      : [...form.byDays, code];
    patch({ byDays });
  }

  return (
    <BottomSheet
      onOpenChange={(next) => {
        if (!next) setEmojiOpen(false);
        onOpenChange(next);
      }}
      open={open}
      title={isNew ? t("recurring.newTitle") : t("recurring.editTitle")}
    >
      <form className="space-y-4 pt-1" onSubmit={onSubmit}>
        {/* 收 / 支 Segmented Control */}
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#FFF6D9] p-1.5">
          {(
            [
              {
                key: "expense" as const,
                label: t("recurring.expense"),
                Icon: ArrowUpRight,
              },
              {
                key: "income" as const,
                label: t("recurring.income"),
                Icon: ArrowDownLeft,
              },
            ] as const
          ).map(({ key, label, Icon }) => {
            const active = form.direction === key;
            return (
              <button
                className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  active
                    ? key === "expense"
                      ? "bg-white text-[#E07A3D] shadow-sm"
                      : "bg-white text-[#2A9D8F] shadow-sm"
                    : "text-[#A08875]"
                }`}
                key={key}
                onClick={() =>
                  patch({
                    direction: key,
                    emoji:
                      form.emoji === "cloud" ||
                      form.emoji === "banknote" ||
                      form.emoji === "☁️" ||
                      form.emoji === "💵"
                        ? defaultRecurringIconId(key)
                        : form.emoji,
                  })
                }
                type="button"
              >
                <Icon className="size-4" strokeWidth={2.25} />
                {label}
              </button>
            );
          })}
        </div>

        {/* 名称 + Lucide 图标 */}
        <div>
          <p className="text-xs font-medium text-[#A08875]">{t("recurring.name")}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              aria-label={t("recurring.aria.pickIcon")}
              className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] text-[#6E6559] shadow-sm transition-all active:scale-95"
              onClick={() => setEmojiOpen((v) => !v)}
              type="button"
            >
              <AppIcon
                className="size-5"
                id={form.emoji || defaultRecurringIconId(form.direction)}
              />
            </button>
            <input
              className={textFieldClass}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder={t("recurring.namePlaceholder")}
              value={form.name}
            />
          </div>
          {emojiOpen && (
            <div className="mt-2 rounded-2xl border border-[#EFE5D3] bg-white p-2.5 shadow-sm">
              <div className="grid grid-cols-7 gap-1.5">
                {RECURRING_EMOJIS.map((iconId) => {
                  const active = form.emoji === iconId;
                  return (
                    <button
                      className={`grid size-10 place-items-center rounded-xl transition-all active:scale-95 ${
                        active
                          ? "bg-[#F8A055]/20 text-[#8C6D53] ring-2 ring-[#F8A055]"
                          : "bg-[#FAF6EC] text-[#9C9181]"
                      }`}
                      key={iconId}
                      onClick={() => {
                        patch({ emoji: iconId });
                        setEmojiOpen(false);
                      }}
                      type="button"
                    >
                      <AppIcon className="size-4" id={iconId} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 金额 */}
        <label className="block text-xs font-medium text-[#A08875]">
          {t("recurring.amountHkd")}
          <input
            className={numberFieldClass}
            inputMode="decimal"
            min="0.01"
            onChange={(event) => patch({ amount: event.target.value })}
            placeholder="0.00"
            step="0.01"
            type="number"
            value={form.amount}
          />
        </label>

        {/* 周期类型 */}
        <label className="relative block text-xs font-medium text-[#A08875]">
          {t("recurring.periodType")}
          <select
            className={selectFieldClass}
            onChange={(event) =>
              patch({ kind: event.target.value as RecurrenceKind })
            }
            value={form.kind}
          >
            <option value="monthly">{t("recurring.kind.monthly")}</option>
            <option value="yearly">{t("recurring.kind.yearly")}</option>
            <option value="by_days">{t("recurring.kind.byDays")}</option>
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-[2.35rem] size-4 text-[#A08875] opacity-0"
          />
        </label>

        {form.kind === "by_days" ? (
          <div>
            <p className="text-xs font-medium text-[#A08875]">{t("recurring.weekdays")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map(({ code }) => {
                const active = form.byDays.includes(code);
                return (
                  <button
                    className={`grid size-9 place-items-center rounded-full text-xs font-bold transition-all active:scale-95 ${
                      active
                        ? "bg-[#F8A055] text-white"
                        : "bg-[#FAF6EC] text-[#A08875]"
                    }`}
                    key={code}
                    onClick={() => toggleWeekday(code)}
                    type="button"
                  >
                    {t(`recurring.weekday.${code.toLowerCase()}` as Parameters<typeof t>[0])}
                  </button>
                );
              })}
            </div>
            <button
              className="mt-2 text-xs font-semibold text-[#F8A055]"
              onClick={() => patch({ byDays: [...WORKDAYS] })}
              type="button"
            >
              {t("recurring.oneClickWorkdays")}
            </button>
            <p className="mt-2 flex items-start gap-1 text-xs leading-5 text-[#A08875]">
              <Lightbulb className="mt-0.5 size-3 shrink-0" strokeWidth={2.25} />
              {t("recurring.nextChargeDate", { date: nextDateHint })}
            </p>
          </div>
        ) : form.kind === "monthly" ? (
          <div>
            <label className="block text-xs font-medium text-[#A08875]">
              {t("recurring.dayOfMonth")}
              <input
                className={numberFieldClass}
                max="31"
                min="1"
                onChange={(event) => patch({ dayOfMonth: event.target.value })}
                type="number"
                value={form.dayOfMonth}
              />
            </label>
            <p className="mt-2 flex items-start gap-1 text-xs leading-5 text-[#A08875]">
              <Lightbulb className="mt-0.5 size-3 shrink-0" strokeWidth={2.25} />
              {t("recurring.nextChargeDate", { date: nextDateHint })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-[#A08875]">
                {t("recurring.month")}
                <select
                  className={selectFieldClass}
                  onChange={(event) =>
                    patch({ monthOfYear: event.target.value })
                  }
                  value={form.monthOfYear}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      {t("recurring.monthN", { n: i + 1 })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[#A08875]">
                {t("recurring.dayOfMonthYearly")}
                <input
                  className={numberFieldClass}
                  max="31"
                  min="1"
                  onChange={(event) =>
                    patch({ dayOfMonth: event.target.value })
                  }
                  type="number"
                  value={form.dayOfMonth}
                />
              </label>
            </div>
            <p className="flex items-start gap-1 text-xs leading-5 text-[#A08875]">
              <Lightbulb className="mt-0.5 size-3 shrink-0" strokeWidth={2.25} />
              {t("recurring.nextChargeDate", { date: nextDateHint })}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-[#A08875]">
            {t("recurring.endDateOptional")}
            <div className="relative mt-2">
              <input
                className={dateFieldClass}
                onChange={(event) => patch({ endDate: event.target.value })}
                onClick={(event) => {
                  // Vaul 抽屉会吞掉原生 date 交互；主动唤起选择器
                  const el = event.currentTarget;
                  try {
                    el.showPicker?.();
                  } catch {
                    // 部分浏览器不支持 showPicker，走默认行为即可
                  }
                }}
                onPointerDown={(event) => {
                  // 阻止抽屉拖拽 / 外部点击逻辑抢走手势
                  event.stopPropagation();
                }}
                type="date"
                value={form.endDate}
              />
              <CalendarDays
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#A08875]"
              />
            </div>
          </label>
          <label className="block text-xs font-medium text-[#A08875]">
            {t("recurring.remindDays")}
            <input
              className={numberFieldClass}
              min="0"
              onChange={(event) => patch({ remindDays: event.target.value })}
              type="number"
              value={form.remindDays}
            />
          </label>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF6D9] px-3.5 py-3.5">
          <span className="text-sm font-semibold text-[#4A3E3D]">
            {t("recurring.autoWrite")}
          </span>
          <input
            checked={form.autoWrite}
            className="size-5 accent-[#EE7828]"
            onChange={(event) => patch({ autoWrite: event.target.checked })}
            type="checkbox"
          />
        </label>

        {!isNew && onEarlyWrite && (
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#EFE5D3] bg-white text-sm font-bold text-[#8C6D53] shadow-sm transition-all active:scale-95 disabled:opacity-50"
            disabled={earlyWriting}
            onClick={() => void onEarlyWrite()}
            type="button"
          >
            <Zap className="size-4 text-[#F8A055]" />
            {earlyWriting ? t("recurring.earlyWriting") : t("recurring.earlyWrite")}
          </button>
        )}

        <button
          className="w-full rounded-xl bg-[#EE7828] py-3.5 text-base font-bold text-white shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
          type="submit"
        >
          {t("recurring.saveSettings")}
        </button>

        {!isNew && onDelete && (
          <button
            className="w-full py-2 text-center text-sm font-semibold text-[#C47A6A] transition-opacity active:opacity-70"
            onClick={onDelete}
            type="button"
          >
            {t("recurring.deleteItem")}
          </button>
        )}
      </form>
    </BottomSheet>
  );
}
