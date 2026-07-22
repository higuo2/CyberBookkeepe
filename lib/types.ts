export type TransactionType = "EXPENSE" | "INCOME";

export interface Transaction {
  id?: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  note: string;
  /** 客户端语义标记；主库无此列，自动记账写入 note 标记 */
  auto_generated?: boolean;
}

export type TransactionDraft = Omit<Transaction, "id">;

/** AI parse result: includes cat comment for UI only (not stored in Supabase). */
export interface ParsedTransaction extends TransactionDraft {
  comment: string;
}

export type ParseErrorCode =
  | "EMPTY_INPUT"
  | "UNPARSEABLE"
  | "INVALID_JSON"
  | "VALIDATION_FAILED"
  | "UPSTREAM_ERROR"
  | "SERVER_MISCONFIGURED";

export type ParseApiResponse =
  | { ok: true; data: ParsedTransaction[] }
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
