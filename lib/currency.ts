/** 原生多币种：禁止跨币种相加或自动汇率换算 */

export const CURRENCY_CODES = ["HKD", "CNY", "JPY", "KRW"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "HKD";

export const CURRENCY_STORAGE_KEY = "cyberbookkeeper_currency";

/** 无小数位的币种（日元 / 韩元） */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<CurrencyCode> = new Set([
  "JPY",
  "KRW",
]);

export const CURRENCY_META: Record<
  CurrencyCode,
  {
    label: string;
    symbol: string;
    flag: string;
    /** 统计页横向卡片背景（Tailwind 类） */
    cardGradient: string;
  }
> = {
  HKD: {
    label: "港币",
    symbol: "HK$",
    flag: "🇭🇰",
    cardGradient: "bg-gradient-to-br from-[#FFFDF7] to-[#FFEEDD]",
  },
  CNY: {
    label: "人民币",
    symbol: "¥",
    flag: "🇨🇳",
    cardGradient: "bg-gradient-to-br from-[#FFF5F5] to-[#FFE2E2]",
  },
  JPY: {
    label: "日元",
    symbol: "¥",
    flag: "🇯🇵",
    cardGradient: "bg-gradient-to-br from-[#FAF5FF] to-[#F3E8FF]",
  },
  KRW: {
    label: "韩元",
    symbol: "₩",
    flag: "🇰🇷",
    cardGradient: "bg-gradient-to-br from-[#F0F9FF] to-[#E0F2FE]",
  },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    (CURRENCY_CODES as readonly string[]).includes(value)
  );
}

export function currencyFractionDigits(
  currency: CurrencyCode | string | undefined,
): number {
  const c = normalizeCurrency(currency);
  return ZERO_DECIMAL_CURRENCIES.has(c) ? 0 : 2;
}

/** 旧数据缺省币种 → HKD；遗留 USD/EUR 映射为 HKD */
export function normalizeCurrency(value: unknown): CurrencyCode {
  if (typeof value !== "string") return DEFAULT_CURRENCY;
  const upper = value.trim().toUpperCase();
  if (isCurrencyCode(upper)) return upper;
  // 历史遗留币种：并入默认港币
  if (upper === "USD" || upper === "EUR") return DEFAULT_CURRENCY;

  const lower = value.toLowerCase();
  if (
    /韩元|韩币|krw|₩|olive\s*young|弘大|明洞|东大门|k-?pop|韩国|医美|免税店/.test(
      lower,
    ) ||
    /₩/.test(value)
  ) {
    return "KRW";
  }
  if (
    /日元|yen|jpy|円|suica|药妆|罗森|lawson|西瓜卡|扭蛋|二次元|日本/.test(lower)
  ) {
    return "JPY";
  }
  if (/人民币|rmb|cny|￥|饿了么|美团|盒马|国内/.test(lower) || /￥/.test(value)) {
    return "CNY";
  }
  if (
    /港币|港元|hkd|hk\$|八达通|汇丰|恒生|百佳|惠康|麦当劳|7-?11|蚊/.test(lower)
  ) {
    return "HKD";
  }
  return DEFAULT_CURRENCY;
}

export function readDefaultCurrency(): CurrencyCode {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
  return isCurrencyCode(raw) ? raw : DEFAULT_CURRENCY;
}

export function writeDefaultCurrency(code: CurrencyCode) {
  localStorage.setItem(CURRENCY_STORAGE_KEY, code);
}

export function currencySymbol(code: CurrencyCode | string | undefined) {
  const c = normalizeCurrency(code);
  return CURRENCY_META[c].symbol;
}

/** 按币种格式化金额（不做汇率换算）；JPY/KRW 无小数 */
export function formatMoney(
  amount: number,
  currency: CurrencyCode | string | undefined = DEFAULT_CURRENCY,
) {
  const c = normalizeCurrency(currency);
  const n = Number(amount) || 0;
  const fractionDigits = currencyFractionDigits(c);
  const abs = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(n));
  return `${n < 0 ? "-" : ""}${CURRENCY_META[c].symbol}${abs}`;
}

/** 从交易列表提取出现过的币种（缺省按 HKD） */
export function currenciesInTransactions(
  items: { currency?: string | null }[],
): CurrencyCode[] {
  const set = new Set<CurrencyCode>();
  for (const item of items) {
    set.add(normalizeCurrency(item.currency));
  }
  return CURRENCY_CODES.filter((c) => set.has(c));
}

export function withCurrencyFallback<T extends { currency?: string | null }>(
  item: T,
): T & { currency: CurrencyCode } {
  return { ...item, currency: normalizeCurrency(item.currency) };
}
