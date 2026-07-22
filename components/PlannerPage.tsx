"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  PiggyBank,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { BudgetProgressCard } from "@/components/BudgetProgressCard";
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

type SheetKind =
  | { type: "goal"; goalId: string | "new"; focusDeposit?: boolean }
  | { type: "recurring"; itemId: string | "new" }
  | null;

const fieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] px-3 text-sm text-[#4A3E3D] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

function EmojiPicker({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (emoji: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((emoji) => (
        <button
          className={`grid size-10 place-items-center rounded-xl text-lg transition-all active:scale-95 ${
            value === emoji
              ? "bg-[#F8A055]/20 ring-2 ring-[#F8A055]"
              : "bg-[#FAF6EC]"
          }`}
          key={emoji}
          onClick={() => onChange(emoji)}
          type="button"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function PlannerPage() {
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
    emoji: "🎁",
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
      emoji: "🎁",
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
        emoji: item.emoji || (item.direction === "income" ? "💵" : "☁️"),
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
      toast.error("请填写愿望名称");
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      toast.error("请输入有效目标金额");
      return;
    }
    if (!Number.isFinite(saved) || saved < 0) {
      toast.error("请输入有效已存金额");
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
      toast.success("愿望已添加");
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
        ? "又离愿望更近一步了喵！"
        : "愿望已更新",
    );
  }

  function deleteGoal() {
    if (!activeGoal) return;
    if (!window.confirm(`确定删除愿望「${activeGoal.title}」吗？`)) return;
    const nextGoals = goals.filter((g) => g.id !== activeGoal.id);
    setGoals(nextGoals);
    writeGoals(nextGoals);
    setSheet(null);
    toast.success("愿望已删除");
  }

  async function saveRecurring(event: FormEvent) {
    event.preventDefault();
    const amount = Number(recurringForm.amount);
    if (!recurringForm.name.trim()) {
      toast.error("请填写名称");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("请输入有效金额");
      return;
    }
    if (recurringForm.kind === "by_days" && recurringForm.byDays.length === 0) {
      toast.error("请至少选择一个星期");
      return;
    }
    if (
      recurringForm.endDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(recurringForm.endDate)
    ) {
      toast.error("截止日期格式无效");
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
          ? "周期项已添加（离线，账单稍后再同步）"
          : "周期项已更新（离线，账单稍后再同步）",
      );
      return;
    }

    const toastId = toast.loading(
      isNewRecurring ? "正在同步账单…" : "正在同步关联账单…",
    );
    try {
      if (isNewRecurring) {
        const created = await syncDueRecurringItems([savedItem]);
        await refreshMonthLedger();
        toast.success(
          created.length > 0
            ? `周期项已添加，并记入 ${created.length} 笔到期账单`
            : "周期项已添加",
          { id: toastId },
        );
      } else {
        const { created } = await reconcileRecurringItemLedger(savedItem);
        await refreshMonthLedger();
        toast.success(
          created > 0
            ? `周期项已更新，并补记 ${created} 笔到期账单`
            : "周期项已更新",
          { id: toastId },
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "账单同步失败，周期项已保存",
        { id: toastId },
      );
    }
  }

  function deleteRecurring() {
    if (!activeRecurring) return;
    if (!window.confirm(`确定删除「${activeRecurring.name}」吗？`)) return;
    const nextItems = items.filter((item) => item.id !== activeRecurring.id);
    setItems(nextItems);
    writeRecurringItems(nextItems);
    setSheet(null);
    toast.success("已删除");
  }

  async function writeEarlyTransaction() {
    if (!activeRecurring) return;
    if (!navigator.onLine) {
      toast.error("当前无网络，无法写入账单");
      return;
    }
    if (isItemLoggedThisMonth(activeRecurring, loggedKeys)) {
      if (activeRecurring.recurrence.kind !== "by_days") {
        toast.message("本月已经记过这笔啦");
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
          ? "今天已经记过这笔啦"
          : "本月已经记过这笔啦",
      );
      return;
    }
    setEarlyWriting(true);
    try {
      await insertTransactionDraft(built.draft);
      setLoggedKeys((prev) => new Set(prev).add(key));
      await refreshMonthLedger();
      toast.success(
        `已提前记入${activeRecurring.name} ${formatHKD(activeRecurring.amount)}~`,
      );
      setSheet(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "写入账单失败，请稍后重试",
      );
    } finally {
      setEarlyWriting(false);
    }
  }

  if (!ready) {
    return <div className="h-full bg-[#FAF6EC]" />;
  }

  return (
    <>
      <main className="h-full overflow-y-auto overscroll-contain bg-[#FAF6EC] px-4 pb-5 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y">
        <header className="mb-4">
          <p className="text-sm font-semibold text-[#F8A055]">规划与资产</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#4A3E3D]">
            规划
          </h1>
          <p className="mt-1 text-sm text-[#A08875]">
            预算、周期收支与愿望存钱罐。
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <BudgetProgressCard
            onBudgetSaved={setBudget}
            onSpendModeChange={setSpendMode}
            stats={budgetStats}
          />

          <section className="rounded-2xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#4A3E3D]">
                周期收支 & 订阅
              </h2>
              <button
                aria-label="新增周期项"
                className="grid size-8 place-items-center rounded-full bg-[#FFF6D9] text-[#8C6D53] transition-all active:scale-95"
                onClick={() => openRecurring()}
                type="button"
              >
                <Plus className="size-4" strokeWidth={2.5} />
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item) => {
                const { amountLine, detailLine } = formatRecurringLine(item);
                const status = getRecurringCardStatus(item, loggedKeys);
                const isIncome = item.direction === "income";
                return (
                  <button
                    className="relative w-full rounded-2xl border border-[#EFE5D3] bg-[#FFFDF0] p-3 text-left transition-all active:scale-[0.99]"
                    key={item.id}
                    onClick={() => openRecurring(item)}
                    type="button"
                  >
                    {status.kind === "logged" && (
                      <span className="absolute right-3 top-3 rounded-full bg-[#E7F6F2] px-2 py-0.5 text-[10px] font-bold text-[#2A9D8F]">
                        🟢 本月已记入账单
                      </span>
                    )}
                    {status.kind === "upcoming" && (
                      <span className="absolute right-3 top-3 rounded-full bg-[#FFE8D6] px-2 py-0.5 text-[10px] font-bold text-[#E07A3D]">
                        ⏰ {status.days === 0 ? "今天" : `${status.days}天后`}
                        {isIncome ? "发工资" : "扣款"}
                      </span>
                    )}
                    {status.kind === "due_pending" && (
                      <span className="absolute right-3 top-3 rounded-full bg-[#FFF6D9] px-2 py-0.5 text-[10px] font-bold text-[#8C6D53]">
                        待记入账单
                      </span>
                    )}
                    <div className="flex items-start gap-2 pr-28">
                      <span
                        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-base ${
                          isIncome
                            ? "bg-[#E7F6F2]"
                            : "bg-[#FFE8D6]"
                        }`}
                      >
                        {item.emoji ||
                          (isIncome ? "💵" : "☁️")}
                      </span>
                      <div className="min-w-0">
                        <p className="font-extrabold text-[#4A3E3D]">
                          {item.name}
                        </p>
                        <p
                          className={`mt-1 text-sm font-semibold ${
                            isIncome ? "text-[#2A9D8F]" : "text-[#8C6D53]"
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

          <section className="rounded-2xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#F8A055]">
                <PiggyBank className="size-4.5" />
                <h2 className="text-sm font-extrabold text-[#4A3E3D]">
                  愿望存钱罐
                </h2>
              </div>
              <button
                aria-label="新增愿望"
                className="grid size-8 place-items-center rounded-full bg-[#FFF6D9] text-[#8C6D53] transition-all active:scale-95"
                onClick={() => openGoal()}
                type="button"
              >
                <Plus className="size-4" strokeWidth={2.5} />
              </button>
            </div>
            {goals.length === 0 ? (
              <button
                className="w-full rounded-2xl border border-dashed border-[#EFE5D3] bg-[#FFFDF0] py-6 text-sm font-semibold text-[#A08875]"
                onClick={() => openGoal()}
                type="button"
              >
                点击添加第一个愿望
              </button>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => {
                  const pct = goalProgress(goal);
                  return (
                    <div
                      className="rounded-2xl border border-[#EFE5D3] bg-[#FFFDF0] p-3"
                      key={goal.id}
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => openGoal(goal)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-extrabold text-[#4A3E3D]">
                            {goal.emoji} {goal.title}
                          </p>
                          <p className="shrink-0 text-xs font-semibold text-[#A08875]">
                            {pct.toFixed(0)}%
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[#A08875]">
                          已存 {formatHKD(goal.saved)} / 目标{" "}
                          {formatHKD(goal.target)}
                        </p>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#FFF6D9]">
                          <div
                            className="h-full rounded-full bg-[#F8A055] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                      <button
                        className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-[#F8A055] text-sm font-bold text-white transition-all active:scale-95"
                        onClick={() => openGoal(goal, true)}
                        type="button"
                      >
                        存一笔
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
        title={isNewGoal ? "新增愿望" : "管理愿望"}
      >
        <form className="space-y-4 pt-1" onSubmit={saveGoal}>
          <div>
            <p className="text-xs font-medium text-[#A08875]">图标</p>
            <EmojiPicker
              onChange={(emoji) => setGoalForm((prev) => ({ ...prev, emoji }))}
              options={GOAL_EMOJIS}
              value={goalForm.emoji}
            />
          </div>
          <label className="block text-xs font-medium text-[#A08875]">
            愿望名称
            <input
              className={fieldClass}
              onChange={(event) =>
                setGoalForm((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="例如 换新手机"
              value={goalForm.title}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-[#A08875]">
              目标金额（HK$）
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
              已存金额（HK$）
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
              <div className="rounded-2xl bg-[#FFF6D9] p-4">
                <p className="text-sm leading-6 text-[#8C6D53]">
                  又离{goalForm.title || activeGoal.title}近了一步喵！
                </p>
              </div>
              <label className="block text-xs font-medium text-[#A08875]">
                本次存入（可选）
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
                  placeholder="例如 200"
                  step="0.01"
                  type="number"
                  value={goalForm.deposit}
                />
              </label>
            </>
          )}
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A055] font-bold text-white shadow-sm transition-all active:scale-95"
            type="submit"
          >
            <Save className="size-4.5" />
            {isNewGoal ? "添加愿望" : "保存"}
          </button>
          {activeGoal && (
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FFE8E0] text-sm font-bold text-[#E07A3D] transition-all active:scale-95"
              onClick={deleteGoal}
              type="button"
            >
              <Trash2 className="size-4" />
              删除愿望
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
