import { getSupabase } from "@/lib/supabase";
import { hydrateTransaction } from "@/lib/transaction-utils";
import type { Transaction } from "@/lib/types";
import { filterActiveTransactions } from "@/lib/utils";

const SELECT_WITH_CURRENCY =
  "id, amount, type, category, date, note, currency";
const SELECT_LEGACY = "id, amount, type, category, date, note";

export function formatSupabaseError(error: unknown): string {
  const msg = extractErrorMessage(error);
  if (/currency/i.test(msg) && /column|does not exist|schema cache/i.test(msg)) {
    return "数据库缺少 currency 列：请到 Supabase SQL Editor 执行 supabase/migrate-currency.sql";
  }
  return msg || "读取失败，请稍后重试";
}

function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object") {
    const o = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [o.message, o.details, o.hint, o.code]
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);
    return parts.join(", ");
  }
  return String(error);
}

function isMissingCurrencyColumn(error: { message?: string } | null) {
  const msg = error?.message ?? "";
  return /currency/i.test(msg) && /column|does not exist|schema cache/i.test(msg);
}

export type QueryTransactionsOptions = {
  gteDate?: string;
  lteDate?: string;
  eqDate?: string;
  orderAsc?: boolean;
  type?: "EXPENSE" | "INCOME";
  /** 为 true 时保留「已跳过」账单（周期去重需要） */
  includeSkipped?: boolean;
};

/**
 * 查询账单；若库尚未加 currency 列则自动回退旧字段（并按 HKD 水合）。
 */
export async function queryTransactions(
  options?: QueryTransactionsOptions,
): Promise<Transaction[]> {
  const run = async (columns: string) => {
    let q = getSupabase().from("transactions").select(columns);
    if (options?.type) q = q.eq("type", options.type);
    if (options?.eqDate) q = q.eq("date", options.eqDate);
    if (options?.gteDate) q = q.gte("date", options.gteDate);
    if (options?.lteDate) q = q.lte("date", options.lteDate);
    q = q.order("date", { ascending: options?.orderAsc ?? false });
    return q;
  };

  let { data, error } = await run(SELECT_WITH_CURRENCY);
  if (error && isMissingCurrencyColumn(error)) {
    ({ data, error } = await run(SELECT_LEGACY));
  }
  if (error) throw error;

  const rows = (data ?? []).map((row) =>
    hydrateTransaction(row as unknown as Record<string, unknown>),
  );
  return options?.includeSkipped ? rows : filterActiveTransactions(rows);
}
