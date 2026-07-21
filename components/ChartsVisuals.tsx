"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { LoaderCircle, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/CategoryIcon";
import { budgetBarColor } from "@/lib/budget";
import { categoryColor } from "@/lib/category-colors";
import {
  formatHKD,
  writeBudgetToStorage,
} from "@/lib/transaction-utils";
import type { MonthBudgetStats } from "@/lib/types";

function displayCategory(name: string) {
  return name === "居住" ? "住房" : name;
}

export function CategoryPieChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data],
  );

  if (data.length === 0) {
    return (
      <div className="grid h-36 place-items-center text-center">
        <div>
          <p className="font-medium text-[#5C4A32]">暂无数据</p>
          <p className="mt-1 text-sm text-[#A08B68]">记账后即可查看占比</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto mb-2 h-40 w-full max-w-[11rem]">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Pie
              cx="50%"
              cy="50%"
              data={data}
              dataKey="value"
              innerRadius={38}
              nameKey="name"
              outerRadius={55}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell
                  fill={categoryColor(entry.name, index)}
                  key={entry.name}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                border: "1px solid #EFE5D3",
                borderRadius: "16px",
                background: "#FAF6EC",
                boxShadow: "0 8px 24px rgba(92,74,50,.08)",
              }}
              formatter={(value) => formatHKD(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-2.5">
        {data.map((item, index) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          const color = categoryColor(item.name, index);
          return (
            <li className="flex items-center gap-2" key={item.name}>
              <div
                className="grid size-8 shrink-0 place-items-center rounded-lg"
                style={{ backgroundColor: `${color}33`, color }}
              >
                <CategoryIcon category={item.name} className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-[#5C4A32]">
                    {displayCategory(item.name)}
                  </p>
                  <p className="shrink-0 text-xs font-medium tabular-nums text-[#A08B68]">
                    {pct.toFixed(0)}%
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#FFF6D9]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
              <p className="w-[5.5rem] shrink-0 text-right text-sm font-semibold tabular-nums text-[#5C4A32]">
                {formatHKD(item.value)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatTrendDate(date: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { date?: string; amount?: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point?.date) return null;

  return (
    <div className="rounded-xl border border-[#EFE5D3] bg-[#FFFDF0] p-2.5 text-xs text-[#8C6D53] shadow-md">
      <p className="font-medium">{formatTrendDate(point.date)}</p>
      <p className="mt-1 font-semibold tabular-nums text-[#5C4A32]">
        支出：{formatHKD(Number(point.amount) || 0)}
      </p>
    </div>
  );
}

export function TrendBarChart({
  data,
}: {
  data: { date: string; amount: number; label: string }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="creamBarGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#F8A055" />
              <stop offset="100%" stopColor="#FFE8B8" />
            </linearGradient>
          </defs>
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: "#C2B5A5", fontSize: 10 }}
            tickLine={false}
          />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{ fill: "rgba(248, 160, 85, 0.08)" }}
          />
          <Bar
            dataKey="amount"
            fill="url(#creamBarGradient)"
            maxBarSize={36}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDailyAvailable(amount: number) {
  const daily = Math.max(0, Math.round(amount));
  return `HK$${daily.toLocaleString("en-US")} / 天`;
}

export function BudgetProgressCard({
  stats,
  onBudgetSaved,
}: {
  stats: MonthBudgetStats;
  onBudgetSaved?: (budget: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const width = useMemo(
    () => `${Math.min(100, Math.max(0, stats.ratio * 100)).toFixed(1)}%`,
    [stats.ratio],
  );
  const overspent = stats.budget > 0 && stats.ratio > 1;
  const remainingClass = overspent
    ? "text-[#EF4444]"
    : "text-[#8C6D53]";

  function openEditor() {
    setInput(stats.budget > 0 ? String(stats.budget) : "");
    setOpen(true);
  }

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("请输入有效的预算金额");
      return;
    }
    setSaving(true);
    try {
      writeBudgetToStorage(amount);
      onBudgetSaved?.(amount);
      setOpen(false);
      toast.success("本月预算已更新");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-[#EFE5D3] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#5C4A32]">预算进度</h2>
          <button
            aria-label="修改预算"
            className="grid size-8 place-items-center rounded-full text-[#A08875] transition-all hover:bg-[#FFF6D9] active:scale-95"
            onClick={openEditor}
            type="button"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>

        {stats.budget <= 0 ? (
          <p className="mt-3 text-sm text-[#9A7B55]">
            尚未设置预算。点击右上角铅笔图标即可设定本月总预算。
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-[#FFF6D9] p-2.5">
                <p className="text-[10px] font-medium text-[#A08875]">已用</p>
                <p className="mt-1 text-sm font-semibold text-[#5C4A32]">
                  {formatHKD(stats.spent)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#FFF6D9] p-2.5">
                <p className="text-[10px] font-medium text-[#A08875]">剩余</p>
                <p className={`mt-1 text-sm font-semibold ${remainingClass}`}>
                  {formatHKD(stats.remaining)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#FFF6D9] p-2.5">
                <p className="text-[10px] font-medium text-[#A08875]">日均可用</p>
                <p className="mt-1 text-sm font-semibold text-[#5C4A32]">
                  {formatDailyAvailable(stats.dailyAvailable)}
                </p>
              </div>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#FFF6D9]">
              <div
                className={`h-full rounded-full transition-all ${budgetBarColor(stats.ratio)}`}
                style={{ width }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[#A08B68]">
              预算 {formatHKD(stats.budget)} · 已用{" "}
              {(stats.ratio * 100).toFixed(0)}%
            </p>
            {overspent && (
              <p className="mt-1.5 text-xs font-medium text-[#EF4444]">
                ⚠️ 本月预算已超支
              </p>
            )}
          </>
        )}
      </section>

      {open && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#5C4A32]/25 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
        >
          <section className="w-full max-w-md rounded-t-[2rem] border border-[#EFE5D3] bg-[#FAF6EC] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-sm sm:rounded-[2rem] sm:pb-5">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#F8A055]">
                  钱包小猫
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[#5C4A32]">
                  修改本月预算
                </h3>
              </div>
              <button
                aria-label="关闭"
                className="grid size-10 place-items-center rounded-full bg-white text-[#8A7A5C] shadow-sm transition-all active:scale-95"
                disabled={saving}
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </header>

            <form className="mt-5 space-y-4" onSubmit={saveBudget}>
              <label className="block text-xs font-medium text-[#9A7B55]">
                本月总预算（HK$）
                <input
                  autoFocus
                  className="mt-2 h-12 w-full rounded-2xl border border-[#EFE5D3] bg-[#FFFDF0] px-3 text-sm text-[#5C4A32] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="例如 15000"
                  step="1"
                  type="number"
                  value={input}
                />
              </label>
              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A055] font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                disabled={saving}
                type="submit"
              >
                {saving ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : (
                  <Save className="size-5" />
                )}
                保存预算
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
