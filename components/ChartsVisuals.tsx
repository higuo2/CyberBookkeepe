"use client";

import { useMemo } from "react";
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
import { CategoryIcon } from "@/components/CategoryIcon";
import { categoryColor, categoryIconStyle } from "@/lib/category-colors";
import { cream } from "@/lib/cream-theme";
import {
  DEFAULT_CURRENCY,
  formatMoney,
  type CurrencyCode,
} from "@/lib/currency";

import { categoryLabel } from "@/lib/transaction-utils";
import { useI18n } from "@/components/LocaleProvider";

export function CategoryPieChart({
  data,
  currency = DEFAULT_CURRENCY,
}: {
  data: { name: string; value: number }[];
  currency?: CurrencyCode;
}) {
  const { t } = useI18n();
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data],
  );

  if (data.length === 0) {
    return (
      <div className="grid h-36 place-items-center text-center">
        <div>
          <p className="font-medium text-ink">{t("charts.emptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("charts.emptyHint")}</p>
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
                border: `1px solid ${cream.hex.creamBorder}`,
                borderRadius: "16px",
                background: cream.hex.creamBgSoft,
                boxShadow: "0 4px 20px -4px rgba(60,50,40,0.06)",
              }}
              formatter={(value) => formatMoney(Number(value), currency)}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-2.5">
        {data.map((item, index) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          const color = categoryColor(item.name, index);
          const iconStyle = categoryIconStyle(item.name, index);
          return (
            <li className="flex items-center gap-2" key={item.name}>
              <div
                className="grid size-8 shrink-0 place-items-center rounded-xl"
                style={iconStyle}
              >
                <CategoryIcon category={item.name} className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">
                    {categoryLabel(item.name, t)}
                  </p>
                  <p className="shrink-0 font-numeric text-xs font-medium text-ink-muted">
                    {pct.toFixed(0)}%
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-cream-bg-soft">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
              <p className="w-[5.5rem] shrink-0 text-right font-numeric text-sm font-semibold text-ink-body">
                {formatMoney(item.value, currency)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatTrendDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function TrendTooltip({
  active,
  payload,
  currency,
  locale,
  expenseLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { date?: string; amount?: number } }>;
  currency: CurrencyCode;
  locale: string;
  expenseLabel: (amount: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point?.date) return null;

  return (
    <div className="rounded-xl border border-cream-border bg-cream-bg-soft p-2.5 text-xs text-ink-muted shadow-quiet">
      <p className="font-medium">{formatTrendDate(point.date, locale)}</p>
      <p className="mt-1 font-numeric font-semibold text-ink-body">
        {expenseLabel(formatMoney(Number(point.amount) || 0, currency))}
      </p>
    </div>
  );
}

export function TrendBarChart({
  data,
  currency = DEFAULT_CURRENCY,
}: {
  data: { date: string; amount: number; label: string }[];
  currency?: CurrencyCode;
}) {
  const { locale, t } = useI18n();
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: cream.hex.inkMuted, fontSize: 10 }}
            tickLine={false}
          />
          <Tooltip
            content={
              <TrendTooltip
                currency={currency}
                expenseLabel={(amount) => t("charts.tooltipExpense", { amount })}
                locale={locale}
              />
            }
            cursor={{ fill: "rgba(200, 98, 53, 0.06)" }}
          />
          <Bar
            dataKey="amount"
            fill={cream.hex.brandPrimary}
            fillOpacity={0.85}
            maxBarSize={36}
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
