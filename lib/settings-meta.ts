/** 设置页元信息：陪伴天数、最近一次云端成功时间 */

const COMPANION_KEY = "cyberbookkeeper_companion_since";
const LAST_SYNC_KEY = "cyberbookkeeper_last_cloud_sync_at";

function localDateOnly(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 首次打开起算陪伴天数（至少 1） */
export function readCompanionDays(): number {
  if (typeof window === "undefined") return 1;
  let since = localStorage.getItem(COMPANION_KEY);
  if (!since) {
    since = localDateOnly();
    localStorage.setItem(COMPANION_KEY, since);
  }
  const start = new Date(`${since}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    localStorage.setItem(COMPANION_KEY, localDateOnly());
    return 1;
  }
  const today = new Date(`${localDateOnly()}T00:00:00`);
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

export function readLastCloudSyncAt(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_SYNC_KEY);
  return raw && raw.trim() ? raw : null;
}

/** ISO 时间戳；成功读写云端后调用 */
export function touchLastCloudSync(at = new Date()): string {
  const iso = at.toISOString();
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  }
  return iso;
}

export function formatSyncClock(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 按陪伴天数轮换台词下标 */
export function riverQuoteIndex(days: number, poolSize: number): number {
  if (poolSize <= 0) return 0;
  return Math.abs(days) % poolSize;
}
