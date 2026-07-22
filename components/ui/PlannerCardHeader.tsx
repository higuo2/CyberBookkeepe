import type { ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";

const ACTION_BTN =
  "flex h-7 w-7 items-center justify-center rounded-full bg-[#F0ECE1] text-[#5A5046] transition-all hover:bg-[#E2DCCF] active:scale-95";

/** Shared planner card title row */
export function PlannerCardHeader({
  title,
  actionAriaLabel,
  onAction,
  action = "plus",
}: {
  title: string;
  actionAriaLabel: string;
  onAction: () => void;
  action?: "plus" | "pencil";
}) {
  const Icon = action === "pencil" ? Pencil : Plus;
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-bold text-[#2C2420]">{title}</h2>
      <button
        aria-label={actionAriaLabel}
        className={ACTION_BTN}
        onClick={onAction}
        type="button"
      >
        <Icon className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

export function MetricLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[12px] font-medium text-[#8C8273]">{children}</p>
  );
}

export function MetricValue({
  children,
  className = "text-[#2C2420]",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-numeric text-[17px] font-bold tracking-tight ${className}`}
    >
      {children}
    </p>
  );
}
