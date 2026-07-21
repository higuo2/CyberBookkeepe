/** Shared cream / wallet-cat theme class snippets */

export const cream = {
  page: "min-h-dvh bg-[#FAF6EC] px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))]",
  eyebrow: "text-sm font-semibold text-[#F8A055]",
  title: "mt-1 text-3xl font-semibold tracking-tight text-[#5C4A32]",
  subtitle: "mt-2 text-sm text-[#9A7B55]",
  card: "rounded-3xl border border-[#F0E6C8] bg-white p-5 shadow-sm",
  cardSoft: "rounded-2xl border border-[#F0E6C8] bg-white p-4 shadow-sm",
  iconBtn:
    "grid size-11 place-items-center rounded-full border border-[#F0E6C8] bg-white text-[#8A7A5C] shadow-sm transition-all active:scale-95 disabled:opacity-50",
  field:
    "h-12 w-full rounded-2xl border border-[#F0E6C8] bg-[#FFFDF0] px-3 text-sm text-[#5C4A32] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15",
  primaryBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A055] text-sm font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50",
  mintBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#A3E4D7] text-sm font-semibold text-[#1F4A44] shadow-sm transition-all active:scale-95 disabled:opacity-50",
  muted: "text-[#9A7B55]",
  ink: "text-[#5C4A32]",
  accent: "text-[#F8A055]",
  expense: "text-[#E07A3D]",
  income: "text-[#2A9D8F]",
  spinner: "text-[#F8A055]",
  segment: "grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF6D9] p-1.5",
  warmPanel: "rounded-2xl bg-[#FFF6D9] p-3",
} as const;
