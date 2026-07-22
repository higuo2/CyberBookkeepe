/** 周期账单软删除（跳过）标记；保留 #rec 以防同步复活 */
export const REC_SKIP_MARK = "[已跳过]";

/** 擦除系统去重标签、跳过标记与旧版「【自动】」前缀，仅用于前端展示。 */
export function cleanNote(note?: string): string {
  if (!note) return "";
  return note
    .replace(/#rec:\S+/g, "")
    .replace(/#msg:\S+/g, "")
    .replace(/\[已跳过\]/g, "")
    .replace(/【自动】/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 是否为周期规则自动生成的账单（备注含 #rec 去重标签）。 */
export function isRecurringNote(note?: string): boolean {
  return Boolean(note && /#rec:\S+/.test(note));
}

/** 用户已软删除/跳过的周期账单（仍保留 #rec，sync 不会重生） */
export function isSkippedRecurringTx(note?: string): boolean {
  return isRecurringNote(note) && Boolean(note && note.includes(REC_SKIP_MARK));
}

/** 列表/统计用：隐藏已跳过的周期账单 */
export function isActiveTransaction(tx: { note?: string }): boolean {
  return !isSkippedRecurringTx(tx.note);
}

export function filterActiveTransactions<T extends { note?: string }>(
  rows: T[],
): T[] {
  return rows.filter(isActiveTransaction);
}

/** 软删除：附加跳过标记，保留全部 #rec / #msg 标签 */
export function markRecurringTxSkipped(note: string): string {
  if (note.includes(REC_SKIP_MARK)) return note;
  return `${note} ${REC_SKIP_MARK}`.trim();
}

/** AI 确认幂等标记：#msg:{messageId} 或 #msg:{messageId}:{recordIndex} */
export function chatMsgMarker(messageId: string, recordIndex?: number) {
  return recordIndex === undefined
    ? `#msg:${messageId}`
    : `#msg:${messageId}:${recordIndex}`;
}

/** 从备注中提取全部 #rec 系统标签（写入 / 更新时回填用）。 */
export function extractRecTags(note?: string): string[] {
  if (!note) return [];
  return note.match(/#rec:\S+/g) ?? [];
}

/**
 * 把用户可见备注与原始备注中的 #rec 标签合并，
 * 避免编辑保存时把去重标记抹掉。
 */
export function withPreservedRecTags(
  visibleNote: string,
  originalNote?: string,
): string {
  const tags = extractRecTags(originalNote);
  const skip = originalNote?.includes(REC_SKIP_MARK) ? REC_SKIP_MARK : "";
  const msgTags = originalNote?.match(/#msg:\S+/g) ?? [];
  const base = cleanNote(visibleNote);
  const parts = [base, ...tags, ...msgTags, skip].filter(Boolean);
  return parts.join(" ");
}
