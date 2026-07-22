"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  Clock,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppIcon, defaultRecurringIconId } from "@/components/AppIcons";
import { BottomSheet } from "@/components/BottomSheet";
import { BudgetProgressCard } from "@/components/BudgetProgressCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlannerCardHeader } from "@/components/ui/PlannerCardHeader";
import {
  RecurringEditorSheet,
  computeFormNextDate,
  emptyRecurringForm,
  type RecurringFormState,
} from "@/components/RecurringEditorSheet";
import { computeBudgetStats } from "@/lib/budget";
import {
  GOAL_EMOJIS,
  WORKDAYS,
  createGoal,
  createRecurringItem,
  estimateRemainingFixedExpenses,
  formatRecurringLine,
  goalProgress,
  readBudgetSpendMode,
  readGoals,
  readRecurringItems,
  writeGoals,
  writeRecurringItems,
  formatHKD,
  type BudgetSpendMode,
  type RecurringItem,
  type WishlistGoal,
} from "@/lib/planner";
import {
  buildEarlyWriteDraft,
  extractLoggedKeys,
  fetchMonthTransactions,
  getRecurringCardStatus,
  insertTransactionDraft,
  isItemLoggedThisMonth,
  loggedKey,
  reconcileRecurringItemLedger,
  syncDueRecurringItems,
} from "@/lib/recurring-sync";
import { readBudgetFromStorage } from "@/lib/transaction-utils";
import { filterActiveTransactions } from "@/lib/utils";
import { useI18n } from "@/components/LocaleProvider";

type SheetKind =
  | { type: "goal"; goalId: string | "new"; focusDeposit?: boolean }
  | { type: "recurring"; itemId: string | "new" }
  | null;

const fieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-[#EAE5D9] bg-[#F0ECE1] px-3 text-sm text-[#4A3E3D] outline-none transition-all focus:border-[#C86235] focus:ring-4 focus:ring-[#C86235]/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

function IconPicker({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (iconId: string) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-5 gap-2">
      {options.map((iconId) => {
        const active = value === iconId;
        return (
          <button
            className={`grid size-10 place-items-center rounded-xl transition-all duration-150 active:scale-[0.98] ${
              active
                ? "bg-[#C86235]/20 text-[#8C6D53] ring-2 ring-[#C86235]"
                : "bg-[#F6F4EE] text-[#9C9181]"
            }`}
            key={iconId}
            onClick={() => onChange(iconId)}
            type="button"
          >
            <AppIcon className="size-4" id={iconId} />
          </button>
        );
      })}
    </div>
  );
}

export function PlannerPage() {
  const { locale, t } = useI18n();
  const [ready, setReady] = useState(false);
  const [goals, setGoals] = useState<WishlistGoal[]>([]);
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [budget, setBudget] = useState(0);
  const [monthSpent, setMonthSpent] = useState(0);
  const [spendMode, setSpendMode] = useState<BudgetSpendMode>("actual");
  const [loggedKeys, setLoggedKeys] = useState<Set<string>>(new Set());
  const [earlyWriting, setEarlyWriting] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const [goalForm, setGoalForm] = useState({
    title: "",
    emoji: "gift",
    target: "",
    saved: "",
    deposit: "",
  });
  const [recurringForm, setRecurringForm] = useState<RecurringFormState>(
    emptyRecurringForm,
  );

  const refreshMonthLedger = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const monthTx = await fetchMonthTransactions();
      setLoggedKeys(extractLoggedKeys(monthTx));
      const spent = filterActiveTransactions(monthTx)
        .filter((row) => row.type === "EXPENSE")
        .reduce((sum, row) => sum + Number(row.amount), 0);
      setMonthSpent(spent);
    } catch {
      // keep last known
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGoals(readGoals());
      setItems(readRecurringItems());
      setBudget(readBudgetFromStorage());
      setSpendMode(readBudgetSpendMode());
      setReady(true);
      void refreshMonthLedger();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshMonthLedger]);

  const estimatedFixed = useMemo(
    () => estimateRemainingFixedExpenses(items, new Date(), loggedKeys),
    [items, loggedKeys],
  );

  const budgetStats = useMemo(
    () =>
      computeBudgetStats(budget, monthSpent, new Date(), {
        estimatedFixed,
        spendMode,
      }),
    [budget, monthSpent, estimatedFixed, spendMode],
  );

  const isNewGoal = sheet?.type === "goal" && sheet.goalId === "new";
  const activeGoal =
    sheet?.type === "goal" && sheet.goalId !== "new"
      ? goals.find((g) => g.id === sheet.goalId)
      : null;
  const isNewRecurring =
    sheet?.type === "recurring" && sheet.itemId === "new";
  const activeRecurring =
    sheet?.type === "recurring" && sheet.itemId !== "new"
      ? items.find((item) => item.id === sheet.itemId)
      : null;

  function openGoal(goal?: WishlistGoal, focusDeposit = false) {
    if (goal) {
      setGoalForm({
        title: goal.title,
        emoji: goal.emoji,
        target: String(goal.target),
        saved: String(goal.saved),
        deposit: "",
      });
      setSheet({ type: "goal", goalId: goal.id, focusDeposit });
      return;
    }
    setGoalForm({
      title: "",
      emoji: "gift",
      target: "",
      saved: "0",
      deposit: "",
    });
    setSheet({ type: "goal", goalId: "new" });
  }

  function openRecurring(item?: RecurringItem) {
    if (item) {
      setRecurringForm({
        name: item.name,
        amount: String(item.amount),
        direction: item.direction,
        kind: item.recurrence.kind,
        dayOfMonth: String(
          item.recurrence.dayOfMonth ??
            Number(item.nextDate.slice(8, 10)) ??
            10,
        ),
        monthOfYear: String(Number(item.nextDate.slice(5, 7)) || 1),
        byDays: item.recurrence.by_days?.length
          ? [...item.recurrence.by_days]
          : [...WORKDAYS],
        endDate: item.recurrence.end_date ?? "",
        remindDays: String(item.remindDays),
        autoWrite: item.autoWrite !== false,
        emoji: item.emoji || defaultRecurringIconId(item.direction),
      });
      setSheet({ type: "recurring", itemId: item.id });
      return;
    }
    setRecurringForm(emptyRecurringForm());
    setSheet({ type: "recurring", itemId: "new" });
  }

  function saveGoal(event: FormEvent) {
    event.preventDefault();
    const target = Number(goalForm.target);
    const saved = Number(goalForm.saved);
    const deposit = Number(goalForm.deposit);

    if (!goalForm.title.trim()) {
      toast.error(t("toast.needWishName"));
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      toast.error(t("toast.needTargetAmount"));
      return;
    }
    if (!Number.isFinite(saved) || saved < 0) {
      toast.error(t("toast.needSavedAmount"));
      return;
    }

    if (isNewGoal) {
      const created = createGoal({
        title: goalForm.title,
        emoji: goalForm.emoji,
        target,
        saved: Math.min(target, saved),
      });
      const nextGoals = [created, ...goals];
      setGoals(nextGoals);
      writeGoals(nextGoals);
      setSheet(null);
      toast.success(t("toast.wishAdded"));
      return;
    }

    if (!activeGoal) return;
    let nextSaved = Math.min(target, saved);
    if (Number.isFinite(deposit) && deposit > 0) {
      nextSaved = Math.min(target, nextSaved + deposit);
    }

    const nextGoals = goals.map((g) =>
      g.id === activeGoal.id
        ? {
            ...g,
            title: goalForm.title.trim(),
            emoji: goalForm.emoji,
            target,
            saved: nextSaved,
          }
        : g,
    );
    setGoals(nextGoals);
    writeGoals(nextGoals);
    setSheet(null);
    toast.success(
      Number.isFinite(deposit) && deposit > 0
        ? t("toast.wishCloser")
        : t("toast.wishUpdated"),
    );
  }

  function deleteGoal() {
    if (!activeGoal) return;
    if (!window.confirm(t("planner.confirmDeleteWish", { title: activeGoal.title }))) return;
    const nextGoals = goals.filter((g) => g.id !== activeGoal.id);
    setGoals(nextGoals);
    writeGoals(nextGoals);
    setSheet(null);
    toast.success(t("toast.wishDeleted"));
  }

  async function saveRecurring(event: FormEvent) {
    event.preventDefault();
    const amount = Number(recurringForm.amount);
    if (!recurringForm.name.trim()) {
      toast.error(t("toast.needName"));
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("toast.needAmount"));
      return;
    }
    if (recurringForm.kind === "by_days" && recurringForm.byDays.length === 0) {
      toast.error(t("toast.needWeekday"));
      return;
    }
    if (
      recurringForm.endDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(recurringForm.endDate)
    ) {
      toast.error(t("toast.invalidEndDate"));
      return;
    }

    const dayOfMonth = Math.min(
      31,
      Math.max(1, Number(recurringForm.dayOfMonth) || 1),
    );
    const nextDate = computeFormNextDate(recurringForm);

    const payload = {
      name: recurringForm.name.trim(),
      amount,
      direction: recurringForm.direction,
      recurrence: {
        kind: recurringForm.kind,
        dayOfMonth:
          recurringForm.kind === "monthly" || recurringForm.kind === "yearly"
            ? dayOfMonth
            : undefined,
        by_days:
          recurringForm.kind === "by_days" ? recurringForm.byDays : undefined,
        end_date: recurringForm.endDate || null,
      },
      nextDate,
      remindDays: Math.max(0, Number(recurringForm.remindDays) || 0),
      autoWrite: recurringForm.autoWrite,
      emoji: recurringForm.emoji || undefined,
    };

    let nextItems: RecurringItem[];
    let savedItem: RecurringItem;
    if (isNewRecurring) {
      savedItem = createRecurringItem(payload);
      nextItems = [savedItem, ...items];
    } else if (activeRecurring) {
      savedItem = { ...activeRecurring, ...payload };
      nextItems = items.map((item) =>
        item.id === activeRecurring.id ? savedItem : item,
      );
    } else {
      return;
    }

    setItems(nextItems);
    writeRecurringItems(nextItems);
    setSheet(null);

    if (!navigator.onLine) {
      toast.success(
        isNewRecurring
          ? t("toast.recurringAddedOffline")
          : t("toast.recurringUpdatedOffline"),
      );
      return;
    }

    const toastId = toast.loading(
      isNewRecurring ? t("toast.syncingBills") : t("toast.syncingLinkedBills"),
    );
    try {
      if (isNewRecurring) {
        const created = await syncDueRecurringItems([savedItem]);
        await refreshMonthLedger();
        toast.success(
          created.length > 0
            ? t("toast.recurringAddedWithBills", { count: created.length })
            : t("toast.recurringAdded"),
          { id: toastId },
        );
      } else {
        const { created } = await reconcileRecurringItemLedger(savedItem);
        await refreshMonthLedger();
        toast.success(
          created > 0
            ? t("toast.recurringUpdatedWithBills", { count: created })
            : t("toast.recurringUpdated"),
          { id: toastId },
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("toast.syncFailSaved"),
        { id: toastId },
      );
    }
  }

  function deleteRecurring() {
    if (!activeRecurring) return;
    if (!window.confirm(t("planner.confirmDeleteRecurring", { name: activeRecurring.name }))) return;
    const nextItems = items.filter((item) => item.id !== activeRecurring.id);
    setItems(nextItems);
    writeRecurringItems(nextItems);
    setSheet(null);
    toast.success(t("toast.deleted"));
  }

  async function writeEarlyTransaction() {
    if (!activeRecurring) return;
    if (!navigator.onLine) {
      toast.error(t("toast.writeOffline"));
      return;
    }
    if (isItemLoggedThisMonth(activeRecurring, loggedKeys)) {
      if (activeRecurring.recurrence.kind !== "by_days") {
        toast.message(t("toast.alreadyLoggedMonth"));
        return;
      }
    }
    const built = buildEarlyWriteDraft(activeRecurring);
    if (!built) return;
    // periodKey 已按月度/日粒度区分，备注内含 #rec 标签，防止到期日重复自动记账
    const key = loggedKey(activeRecurring.id, built.periodKey);
    if (loggedKeys.has(key)) {
      toast.message(
        activeRecurring.recurrence.kind === "by_days"
          ? t("toast.alreadyLoggedToday")
          : t("toast.alreadyLoggedMonth"),
      );
      return;
    }
    setEarlyWriting(true);
    try {
      await insertTransactionDraft(built.draft);
      setLoggedKeys((prev) => new Set(prev).add(key));
      await refreshMonthLedger();
      toast.success(
        t("toast.earlyLogged", {
          name: activeRecurring.name,
          amount: formatHKD(activeRecurring.amount),
        }),
      );
      setSheet(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("toast.writeFail"),
      );
    } finally {
      setEarlyWriting(false);
    }
  }

  if (!ready) {
    return <div className="h-full" />;
  }

  return (
    <>
      <main className="h-full overflow-y-auto overscroll-contain px-4 pb-5 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
        <PageHeader
          caption={t("planner.eyebrow")}
          className="mb-4"
          description={t("planner.subtitle")}
          title={t("planner.title")}
        />

        <div className="flex flex-col gap-3">
          <BudgetProgressCard
            onBudgetSaved={setBudget}
            onSpendModeChange={setSpendMode}
            stats={budgetStats}
          />

          <section className="rounded-2xl border border-[#EAE5D9] bg-white p-4 shadow-2xs">
            <PlannerCardHeader
              action="plus"
              actionAriaLabel={t("planner.aria.addRecurring")}
              onAction={() => openRecurring()}
              title={t("planner.recurringSection")}
            />
            <div className="space-y-2">
              {items.map((item) => {
                const { amountLine, detailLine } = formatRecurringLine(item, t, locale);
                const status = getRecurringCardStatus(item, loggedKeys);
                const isIncome = item.direction === "income";
                return (
                  <button
                    className="relative w-full rounded-xl bg-[#F0ECE1]/70 p-3 text-left transition-all duration-150 active:scale-[0.98]"
                    key={item.id}
                    onClick={() => openRecurring(item)}
                    type="button"
                  >
                    {status.kind === "logged" && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#E8EFE9] px-2 py-0.5 text-[10px] font-bold text-[#5B7A66]">
                        <CheckCircle2 className="size-3.5" strokeWidth={2} />
                        {t("planner.loggedThisMonth")}
                      </span>
                    )}
                    {status.kind === "upcoming" && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#EFEAE8] px-2 py-0.5 text-[10px] font-bold text-[#B8785C]">
                        <Clock className="size-3.5" strokeWidth={2} />
                        {status.days === 0
                          ? t("planner.today")
                          : t("planner.inDays", { days: status.days })}
                        {isIncome ? t("planner.payIncome") : t("planner.payExpense")}
                      </span>
                    )}
                    {status.kind === "due_pending" && (
                      <span className="absolute right-3 top-3 rounded-full bg-[#F2ECE4] px-2 py-0.5 text-[10px] font-bold text-[#8C6D53]">
                        {t("planner.pendingLog")}
                      </span>
                    )}
                    <div className="flex items-start gap-2 pr-28">
                      <span
                        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                          isIncome
                            ? "bg-[#E8EFE9] text-[#5B7A66]"
                            : "bg-[#EFEAE8] text-[#B8785C]"
                        }`}
                      >
                        <AppIcon
                          className="size-4"
                          id={
                            item.emoji ||
                            defaultRecurringIconId(
                              isIncome ? "income" : "expense",
                            )
                          }
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="font-extrabold text-[#4A3E3D]">
                          {item.name}
                        </p>
                        <p
                          className={`mt-1 font-numeric text-sm font-semibold ${
                            isIncome ? "text-income" : "text-expense"
                          }`}
                        >
                          {amountLine}
                        </p>
                        {detailLine ? (
                          <p className="mt-1 text-xs text-[#A08875]">
                            {detailLine}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[#EAE5D9] bg-white p-4 shadow-2xs">
            <PlannerCardHeader
              action="plus"
              actionAriaLabel={t("planner.aria.addWish")}
              onAction={() => openGoal()}
              title={t("planner.wishlistSection")}
            />
            {goals.length === 0 ? (
              <button
                className="w-full rounded-xl border border-dashed border-[#EAE5D9] py-6 text-center text-[13px] text-[#9C9285] transition-all active:scale-[0.98]"
                onClick={() => openGoal()}
                type="button"
              >
                {t("planner.emptyWish")}
              </button>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => {
                  const pct = goalProgress(goal);
                  return (
                    <div
                      className="rounded-xl bg-[#F0ECE1]/70 p-3"
                      key={goal.id}
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => openGoal(goal)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex min-w-0 items-center gap-2 font-extrabold text-[#4A3E3D]">
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#EFEAE8] text-[#B8785C]">
                              <AppIcon
                                className="size-3.5"
                                id={goal.emoji || "gift"}
                              />
                            </span>
                            <span className="truncate">{goal.title}</span>
                          </p>
                          <p className="shrink-0 font-numeric text-xs font-semibold text-[#9C9285]">
                            {pct.toFixed(0)}%
                          </p>
                        </div>
                        <p className="mt-1 font-numeric text-caption">
                          {t("planner.wishProgress", {
                            saved: formatHKD(goal.saved),
                            target: formatHKD(goal.target),
                          })}
                        </p>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#F0ECE1]">
                          <div
                            className="h-full rounded-full bg-[#C86235] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                      <button
                        className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-[#C86235] text-sm font-bold text-white transition-all duration-150 active:scale-[0.98]"
                        onClick={() => openGoal(goal, true)}
                        type="button"
                      >
                        {t("planner.saveOnce")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <BottomSheet
        onOpenChange={(open) => !open && setSheet(null)}
        open={sheet?.type === "goal"}
        title={isNewGoal ? t("planner.wishNewTitle") : t("planner.wishEditTitle")}
      >
        <form className="space-y-4 pt-1" onSubmit={saveGoal}>
          <div>
            <p className="text-xs font-medium text-[#A08875]">{t("planner.wishIcon")}</p>
            <IconPicker
              onChange={(emoji) => setGoalForm((prev) => ({ ...prev, emoji }))}
              options={GOAL_EMOJIS}
              value={goalForm.emoji}
            />
          </div>
          <label className="block text-xs font-medium text-[#A08875]">
            {t("planner.wishName")}
            <input
              className={fieldClass}
              onChange={(event) =>
                setGoalForm((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder={t("planner.wishNamePlaceholder")}
              value={goalForm.title}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-[#A08875]">
              {t("planner.wishTarget")}
              <input
                className={fieldClass}
                inputMode="decimal"
                min="0.01"
                onChange={(event) =>
                  setGoalForm((prev) => ({
                    ...prev,
                    target: event.target.value,
                  }))
                }
                step="0.01"
                type="number"
                value={goalForm.target}
              />
            </label>
            <label className="block text-xs font-medium text-[#A08875]">
              {t("planner.wishSaved")}
              <input
                className={fieldClass}
                inputMode="decimal"
                min="0"
                onChange={(event) =>
                  setGoalForm((prev) => ({
                    ...prev,
                    saved: event.target.value,
                  }))
                }
                step="0.01"
                type="number"
                value={goalForm.saved}
              />
            </label>
          </div>
          {!isNewGoal && activeGoal && (
            <>
              <div className="rounded-2xl bg-[#F0ECE1] p-4">
                <p className="text-sm leading-6 text-[#8C6D53]">
                  {t("planner.wishCloser", { title: goalForm.title || activeGoal.title })}
                </p>
              </div>
              <label className="block text-xs font-medium text-[#A08875]">
                {t("planner.depositOptional")}
                <input
                  autoFocus={sheet?.type === "goal" && sheet.focusDeposit}
                  className={fieldClass}
                  inputMode="decimal"
                  min="0.01"
                  onChange={(event) =>
                    setGoalForm((prev) => ({
                      ...prev,
                      deposit: event.target.value,
                    }))
                  }
                  placeholder={t("planner.depositPlaceholder")}
                  step="0.01"
                  type="number"
                  value={goalForm.deposit}
                />
              </label>
            </>
          )}
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C86235] font-bold text-white shadow-sm transition-all duration-150 active:scale-[0.98]"
            type="submit"
          >
            <Save className="size-5" strokeWidth={2.25} />
            {isNewGoal ? t("planner.addWish") : t("planner.save")}
          </button>
          {activeGoal && (
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#EFEAE8] text-sm font-bold text-[#B8785C] transition-all duration-150 active:scale-[0.98]"
              onClick={deleteGoal}
              type="button"
            >
              <Trash2 className="size-4" strokeWidth={2} />
              {t("planner.deleteWish")}
            </button>
          )}
        </form>
      </BottomSheet>

      <RecurringEditorSheet
        earlyWriting={earlyWriting}
        form={recurringForm}
        isNew={isNewRecurring}
        onDelete={activeRecurring ? deleteRecurring : undefined}
        onEarlyWrite={
          activeRecurring ? () => void writeEarlyTransaction() : undefined
        }
        onFormChange={setRecurringForm}
        onOpenChange={(open) => !open && setSheet(null)}
        onSubmit={saveRecurring}
        open={sheet?.type === "recurring"}
      />
    </>
  );
}
