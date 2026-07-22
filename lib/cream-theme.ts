/** Shared cream / wallet-cat theme — class snippets bound to semantic tokens */

export const cream = {
  page: "h-full overflow-y-auto overscroll-contain bg-cream-bg px-5 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y",
  eyebrow: "text-sm font-semibold text-brand-primary",
  title: "mt-1 text-3xl font-semibold tracking-tight text-ink",
  subtitle: "mt-2 text-sm text-ink-muted",
  card: "rounded-3xl border border-cream-border bg-cream-card p-5 shadow-sm",
  cardSoft: "rounded-2xl border border-cream-border bg-cream-card p-4 shadow-sm",
  iconBtn:
    "grid size-11 place-items-center rounded-full border border-cream-border bg-cream-card text-ink-muted shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  field:
    "h-12 w-full rounded-2xl border border-cream-border bg-cream-bg px-3 text-sm text-ink-body outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15",
  primaryBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  mintBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#A3E4D7] text-sm font-semibold text-[#1F4A44] shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  muted: "text-ink-muted",
  ink: "text-ink-body",
  accent: "text-brand-primary",
  expense: "text-expense",
  income: "text-income",
  danger: "text-danger",
  spinner: "text-brand-primary",
  segment: "grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF6D9] p-1.5",
  warmPanel: "rounded-2xl bg-[#FFF6D9] p-3",
  border: "border-cream-border",
  navActive: "text-[#8C6D53]",
  navIdle: "text-[#BFAFA0]",
  /** Hex mirrors for non-Tailwind contexts (charts, canvas) */
  hex: {
    brandPrimary: "#EE7828",
    expense: "#E07A3D",
    income: "#2A9D8F",
    danger: "#C9786E",
    creamBg: "#FAF6EC",
    creamCard: "#FFFFFF",
    creamBorder: "#EFE5D3",
    ink: "#3A322B",
    inkBody: "#4A3E31",
    inkMuted: "#8C8273",
  },
} as const;
