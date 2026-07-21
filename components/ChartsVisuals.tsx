"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { CategoryIcon } from "@/components/CategoryIcon";
import { budgetBarColor } from "@/lib/budget";
import { categoryColor } from "@/lib/category-colors";
import { formatHKD } from "@/lib/transaction-utils";
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
      <div className="grid h-56 place-items-center text-center">
        <div>
          <p className="font-medium text-[#5C4A32]">暂无数据</p>
          <p className="mt-1 text-sm text-[#A08B68]">记账后即可查看占比</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto h-52 w-full max-w-xs">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Pie
              cx="50%"
              cy="50%"
              data={data}
              dataKey="value"
              innerRadius={52}
              nameKey="name"
              outerRadius={78}
              paddingAngle={3}
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

      <ul className="mt-2 space-y-3">
        {data.map((item, index) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          const color = categoryColor(item.name, index);
          return (
            <li className="flex items-center gap-2.5" key={item.name}>
              <div
                className="grid size-9 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: `${color}33`, color }}
              >
                <CategoryIcon category={item.name} className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
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
              <p className="w-[5.75rem] shrink-0 text-right text-sm font-semibold tabular-nums text-[#5C4A32]">
                {formatHKD(item.value)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BarTopLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
}) {
  const { x = 0, y = 0, width = 0, value } = props;
  const amount = Number(value) || 0;
  if (amount <= 0) return null;
  const cx = Number(x) + Number(width) / 2;
  const cy = Number(y) - 6;
  const text =
    amount >= 1000
      ? `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`
      : String(Math.round(amount));

  return (
    <text
      fill="#A08B68"
      fontSize={10}
      fontWeight={600}
      textAnchor="middle"
      x={cx}
      y={cy}
    >
      {text}
    </text>
  );
}

export function TrendBarChart({
  data,
}: {
  data: { date: string; amount: number; label: string }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="creamBarGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#F8A055" />
              <stop offset="100%" stopColor="#FFE8B8" />
            </linearGradient>
          </defs>
          <CartesianGrid
            horizontal={false}
            stroke="#EFE5D3"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: "#A08B68", fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #EFE5D3",
              borderRadius: "16px",
              background: "#FAF6EC",
            }}
            cursor={{ fill: "rgba(248, 160, 85, 0.08)" }}
            formatter={(value) => formatHKD(Number(value))}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.date ?? ""
            }
          />
          <Bar
            dataKey="amount"
            fill="url(#creamBarGradient)"
            maxBarSize={36}
            radius={[8, 8, 0, 0]}
          >
            <LabelList content={<BarTopLabel />} dataKey="amount" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetProgressCard({ stats }: { stats: MonthBudgetStats }) {
  const width = useMemo(
    () => `${Math.min(100, Math.max(0, stats.ratio * 100)).toFixed(1)}%`,
    [stats.ratio],
  );

  if (stats.budget <= 0) {
    return (
      <section className="rounded-3xl border border-[#EFE5D3] bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[#5C4A32]">本月预算</h2>
        <p className="mt-3 text-sm text-[#9A7B55]">
          尚未设置预算。前往「我的」页面设定本月总预算后，这里会显示进度。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[#EFE5D3] bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-[#5C4A32]">预算进度</h2>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-[#FFF6D9] p-3">
          <p className="text-[10px] text-[#A08B68]">已用</p>
          <p className="mt-1 text-sm font-semibold text-[#5C4A32]">
            {formatHKD(stats.spent)}
          </p>
        </div>
        <div className="rounded-2xl bg-[#FFF6D9] p-3">
          <p className="text-[10px] text-[#A08B68]">剩余</p>
          <p
            className={`mt-1 text-sm font-semibold ${
              stats.remaining < 0 ? "text-[#E07A3D]" : "text-[#8C6D53]"
            }`}
          >
            {formatHKD(stats.remaining)}
          </p>
        </div>
        <div className="rounded-2xl bg-[#FFF6D9] p-3">
          <p className="text-[10px] text-[#A08B68]">日均可用</p>
          <p className="mt-1 text-sm font-semibold text-[#5C4A32]">
            {formatHKD(Math.max(0, stats.dailyAvailable))}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#FFF6D9]">
        <div
          className={`h-full rounded-full transition-all ${budgetBarColor(stats.ratio)}`}
          style={{ width }}
        />
      </div>
      <p className="mt-2 text-xs text-[#A08B68]">
        预算 {formatHKD(stats.budget)} · 已用 {(stats.ratio * 100).toFixed(0)}%
      </p>
    </section>
  );
}
