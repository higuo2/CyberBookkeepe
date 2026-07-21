"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { budgetBarColor } from "@/lib/budget";
import { formatHKD } from "@/lib/transaction-utils";
import type { MonthBudgetStats } from "@/lib/types";

const COLORS = [
  "#F8A055",
  "#F8C96A",
  "#A3E4D7",
  "#E07A3D",
  "#FFE8B8",
  "#7EB8A8",
  "#D4A574",
  "#C0B49A",
];

export function CategoryPieChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center text-center">
        <div>
          <p className="font-medium text-[#5C4A32]">暂无数据</p>
          <p className="mt-1 text-sm text-[#A08B68]">记账后即可查看占比</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <PieChart>
          <Pie
            cx="50%"
            cy="45%"
            data={data}
            dataKey="value"
            innerRadius={54}
            nameKey="name"
            outerRadius={86}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell fill={COLORS[index % COLORS.length]} key={entry.name} />
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
          <Legend
            iconSize={8}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px", color: "#9A7B55" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
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
        <BarChart data={data}>
          <CartesianGrid stroke="#EFE5D3" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: "#A08B68", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "#A08B68", fontSize: 11 }}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #EFE5D3",
              borderRadius: "16px",
              background: "#FAF6EC",
            }}
            formatter={(value) => formatHKD(Number(value))}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.date ?? ""
            }
          />
          <Bar dataKey="amount" fill="#F8A055" radius={[8, 8, 0, 0]} />
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
              stats.remaining < 0 ? "text-[#E07A3D]" : "text-[#2A9D8F]"
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
