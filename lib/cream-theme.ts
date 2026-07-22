/** Shared Quiet Luxury / parchment theme snippets */

const CARD =
  "rounded-2xl border border-[#EAE5D9] bg-white shadow-2xs";

export const cream = {
  page: "h-full overflow-y-auto overscroll-contain px-5 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] touch-pan-y",
  eyebrow: "text-xs font-medium text-ink-muted",
  title: "mt-1 text-2xl font-bold tracking-tight text-ink",
  subtitle: "mt-1 text-xs text-ink-muted",
  card: `${CARD} p-5`,
  cardSoft: `${CARD} p-4`,
  iconBtn:
    "grid size-11 place-items-center rounded-full border border-[#EAE5D9] bg-white text-ink-muted shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  field:
    "h-12 w-full rounded-2xl border border-[#EAE5D9] bg-[#F0ECE1] px-3 text-sm text-ink-body outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10",
  primaryBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary text-sm font-semibold text-white shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  mintBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#E8EFE9] text-sm font-semibold text-[#5B7A66] shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
  muted: "text-ink-muted",
  ink: "text-ink-body",
  accent: "text-brand-primary",
  expense: "text-expense",
  income: "text-income",
  danger: "text-danger",
  spinner: "text-brand-primary",
  segment: "grid grid-cols-2 gap-2 rounded-2xl bg-[#F0ECE1] p-1.5",
  warmPanel: "rounded-2xl bg-[#F0ECE1] p-3",
  border: "border-[#EAE5D9]",
  navActive: "text-ink-body",
  navIdle: "text-ink-muted",
  hex: {
    brandPrimary: "#C86235",
    expense: "#B8785C",
    income: "#5B7A66",
    danger: "#A87870",
    creamBg: "#F6F4EE",
    creamBgSoft: "#FBF9F5",
    creamCard: "#FFFFFF",
    creamBorder: "#EAE5D9",
    creamDivide: "#F0ECE1",
    ink: "#2C2420",
    inkBody: "#5A5046",
    inkMuted: "#9C9285",
  },
} as const;
