export type TransactionType = "EXPENSE" | "INCOME";

export interface Transaction {
  id?: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  note: string;
}

export type ParseErrorCode =
  | "EMPTY_INPUT"
  | "UNPARSEABLE"
  | "INVALID_JSON"
  | "VALIDATION_FAILED"
  | "UPSTREAM_ERROR"
  | "SERVER_MISCONFIGURED";

export type ParseApiResponse =
  | { ok: true; data: Transaction }
  | { ok: false; code: ParseErrorCode; message: string };
