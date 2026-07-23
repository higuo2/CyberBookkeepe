"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useT } from "@/components/LocaleProvider";

/** 居中确认弹窗（主题变量） */
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
      <div className="w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-xl">
        <h2 className="text-lg font-extrabold text-[var(--color-text-main)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-main)] opacity-60">
          {description}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            className="h-11 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] text-sm font-semibold text-[var(--color-text-main)] transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            className={`h-11 flex-1 rounded-2xl text-sm font-bold text-white shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50 ${
              confirmDanger ? "bg-danger" : "bg-[var(--color-primary)]"
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
  iconClassName,
  label,
  value,
  onClick,
  danger = false,
  chevron = true,
  disabled = false,
}: {
  icon: ReactNode;
  /** 图标容器背景，如暖橙淡底 */
  iconClassName?: string;
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  chevron?: boolean;
  disabled?: boolean;
}) {
  const interactive = Boolean(onClick) && !disabled;
  const Comp = interactive ? "button" : "div";

  return (
    <Comp
      className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-all duration-150 ${
        interactive
          ? "active:scale-[0.98] active:bg-[var(--color-bg-soft)]/80"
          : ""
      } ${disabled ? "opacity-80" : ""}`}
      disabled={interactive ? disabled : undefined}
      onClick={interactive ? onClick : undefined}
      type={interactive ? "button" : undefined}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-xl text-[var(--color-text-main)] opacity-90 ${
          iconClassName ?? "bg-[var(--color-bg-soft)] opacity-80"
        }`}
      >
        {icon}
      </span>
      <span
        className={`min-w-0 flex-1 text-sm font-medium ${
          danger ? "text-danger" : "text-[var(--color-text-main)]"
        }`}
      >
        {label}
      </span>
      {value != null && value !== false && value !== "" ? (
        <span className="flex shrink-0 items-center gap-1 font-numeric text-sm font-medium text-[var(--color-text-main)] opacity-60">
          {value}
        </span>
      ) : null}
      {chevron && interactive ? (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-[var(--color-text-main)] opacity-30"
          strokeWidth={2}
        />
      ) : null}
    </Comp>
  );
}
