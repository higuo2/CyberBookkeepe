export type TransactionType = "EXPENSE" | "INCOME";

/** 原生多币种代码；禁止跨币种合计 */
export type CurrencyCode = "HKD" | "CNY" | "JPY" | "KRW";

export interface Transaction {
  id?: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  note: string;
  /** ISO 币种；旧数据缺省按 HKD */
  currency: CurrencyCode;
  /** 客户端语义标记；主库无此列，自动记账写入 note 标记 */
  auto_generated?: boolean;
}

export type TransactionDraft = Omit<Transaction, "id">;

/** AI parse result: includes cat comment for UI only (not stored in Supabase). */
export interface ParsedTransaction extends TransactionDraft {
  comment: string;
}

/** AI 解析出的周期/固定收支（写入规划页） */
export interface ParsedRecurringData {
  title: string;
  amount: number;
  direction: "expense" | "income";
  category: string;
  currency: CurrencyCode;
  period_type: "daily" | "weekly" | "monthly";
  /** 按周：1–7 = 周一至周日 */
  by_days?: number[];
  day_of_month?: number;
  start_date: string;
  end_date?: string;
  auto_record: boolean;
}

/**
 * 统一解析结果：
 * - is_recurring=false → 普通账单（可多笔）
 * - is_recurring=true  → 周期规则（写入规划）
 */
export type ParseSuccessPayload =
  | {
      is_recurring: false;
      data: ParsedTransaction[];
      reply_text: string;
    }
  | {
      is_recurring: true;
      data: ParsedRecurringData;
      reply_text: string;
    };

export type ParseErrorCode =
  | "EMPTY_INPUT"
  | "UNPARSEABLE"
  | "INVALID_JSON"
  | "VALIDATION_FAILED"
  | "UPSTREAM_ERROR"
  | "SERVER_MISCONFIGURED";

export type ParseApiResponse =
  | ({ ok: true } & ParseSuccessPayload)
  | { ok: false; code: ParseErrorCode; message: string };

export type SummaryApiResponse =
  | { ok: true; summary: string }
  | { ok: false; code: ParseErrorCode; message: string };

export interface MonthBudgetStats {
  budget: number;
  spent: number;
  remaining: number;
  dailyAvailable: number;
  ratio: number;
  /** 预估本月剩余固定开销 */
  estimatedFixed: number;
  /** actual = 仅已发生；reserve_fixed = 扣除预估固定开销 */
  spendMode: "actual" | "reserve_fixed";
  /** 参与剩余计算的占用额（已用，或已用+预估固定） */
  committed: number;
}
