import * as XLSX from "xlsx";
import type { Transaction } from "@/lib/types";
import { cleanNote } from "@/lib/utils";
import type { TranslateFn } from "@/lib/i18n";
import { categoryLabel } from "@/lib/transaction-utils";

export function exportTransactionsToXlsx(
  transactions: Transaction[],
  options: { filename?: string; t?: TranslateFn } = {},
) {
  const { t } = options;
  const filename =
    options.filename ??
    `cyberbookkeeper-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const rows = transactions.map((item) => ({
    [t?.("export.col.date") ?? "日期"]: item.date,
    [t?.("export.col.type") ?? "类型"]:
      item.type === "EXPENSE"
        ? (t?.("export.typeExpense") ?? "支出")
        : (t?.("export.typeIncome") ?? "收入"),
    [t?.("export.col.category") ?? "分类"]: categoryLabel(item.category, t),
    [t?.("export.col.currency") ?? "币种"]: item.currency || "HKD",
    [t?.("export.col.amount") ?? "金额"]: Number(item.amount),
    [t?.("export.col.note") ?? "备注"]: cleanNote(item.note),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    t?.("export.sheetName") ?? "账单",
  );
  XLSX.writeFile(workbook, filename);
}
