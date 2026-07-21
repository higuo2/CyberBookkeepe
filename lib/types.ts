export type TransactionType = "EXPENSE" | "INCOME";

export interface Transaction {
  id?: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  note: string;
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
}
