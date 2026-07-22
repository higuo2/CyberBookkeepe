/** 擦除系统去重标签与旧版「【自动】」前缀，仅用于前端展示。 */
export function cleanNote(note?: string): string {
  if (!note) return "";
  return note
    .replace(/#rec:\S+/g, "")
    .replace(/【自动】/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 是否为周期规则自动生成的账单（备注含 #rec 去重标签）。 */
export function isRecurringNote(note?: string): boolean {
  return Boolean(note && /#rec:\S+/.test(note));
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
  const base = cleanNote(visibleNote);
  if (tags.length === 0) return base;
  return base ? `${base} ${tags.join(" ")}` : tags.join(" ");
}
