import * as XLSX from "xlsx";
import type { Transaction } from "@/lib/types";
import { cleanNote } from "@/lib/utils";

export function exportTransactionsToXlsx(
  transactions: Transaction[],
  filename = `cyberbookkeeper-${new Date().toISOString().slice(0, 10)}.xlsx`,
) {
  const rows = transactions.map((item) => ({
    日期: item.date,
    类型: item.type === "EXPENSE" ? "支出" : "收入",
    分类: item.category,
    金额: Number(item.amount),
    备注: cleanNote(item.note),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "账单");
  XLSX.writeFile(workbook, filename);
}
