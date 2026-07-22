"use client";

import type { ReactNode } from "react";
import { useT } from "@/components/LocaleProvider";

/** 居中确认弹窗（奶油风） */
export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmDanger = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDanger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-sm rounded-3xl bg-[#FFFDF0] p-5 shadow-xl">
        <h2 className="text-lg font-extrabold text-[#4A3E3D]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#9A7B55]">{description}</p>
        <div className="mt-5 flex gap-3">
          <button
            className="h-11 flex-1 rounded-2xl border border-[#EFE5D3] bg-white text-sm font-semibold text-[#8C6D53] transition-all active:scale-95 disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            className={`h-11 flex-1 rounded-2xl text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
              confirmDanger ? "bg-[#E07A6A]" : "bg-[#F8A055]"
            }`}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsRow({
  icon,
  label,
  value,
  onClick,
  danger = false,
  chevron = true,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  chevron?: boolean;
  disabled?: boolean;
}) {
  const interactive = Boolean(onClick) && !disabled;
  const Comp = interactive ? "button" : "div";

  return (
    <Comp
      className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors ${
        interactive ? "active:bg-[#FAF6EC]/80" : ""
      } ${disabled ? "opacity-80" : ""}`}
      disabled={interactive ? disabled : undefined}
      onClick={interactive ? onClick : undefined}
      type={interactive ? "button" : undefined}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FFF6D9] text-[#C4956A]">
        {icon}
      </span>
      <span
        className={`min-w-0 flex-1 text-sm font-medium ${
          danger ? "text-[#E07A6A]" : "text-[#4A3E31]"
        }`}
      >
        {label}
      </span>
      {value ? (
        <span className="shrink-0 font-numeric text-sm font-medium text-[#8C8273]">
          {value}
        </span>
      ) : null}
      {chevron && interactive ? (
        <span className="shrink-0 text-[#D4C4B0]" aria-hidden>
          ›
        </span>
      ) : null}
    </Comp>
  );
}
