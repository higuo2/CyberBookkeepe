"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LayoutGrid } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  categoryLabel,
} from "@/lib/transaction-utils";
import type { TransactionType } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";

type TypeFilter = "ALL" | TransactionType;

type MenuItem =
  | { kind: "option"; value: string; label: string }
  | { kind: "divider"; label: string };

export function CategoryFilterDropdown({
  value,
  typeFilter,
  onChange,
}: {
  value: string;
  typeFilter: TypeFilter;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = useMemo<MenuItem[]>(() => {
    const all: MenuItem = { kind: "option", value: "ALL", label: t("common.allCategories") };

    if (typeFilter === "EXPENSE") {
      return [
        all,
        ...EXPENSE_CATEGORIES.map((category) => ({
          kind: "option" as const,
          value: category,
          label: categoryLabel(category, t),
        })),
      ];
    }

    if (typeFilter === "INCOME") {
      return [
        all,
        ...INCOME_CATEGORIES.map((category) => ({
          kind: "option" as const,
          value: category,
          label: categoryLabel(category, t),
        })),
      ];
    }

    return [
      all,
      { kind: "divider", label: t("common.expense") },
      ...EXPENSE_CATEGORIES.map((category) => ({
        kind: "option" as const,
        value: category,
        label: categoryLabel(category, t),
      })),
      { kind: "divider", label: t("common.income") },
      ...INCOME_CATEGORIES.map((category) => ({
        kind: "option" as const,
        value: category,
        label: categoryLabel(category, t),
      })),
    ];
  }, [typeFilter, t]);

  const label =
    value === "ALL"
      ? t("common.allCategories")
      : categoryLabel(value, t);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (value === "ALL") return;
    const allowed =
      typeFilter === "EXPENSE"
        ? EXPENSE_CATEGORIES
        : typeFilter === "INCOME"
          ? INCOME_CATEGORIES
          : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
    if (!allowed.includes(value as never)) {
      onChange("ALL");
    }
  }, [typeFilter, value, onChange]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-9 max-w-[9.5rem] items-center gap-1 rounded-xl border border-[#EFE5D3] bg-white py-0 pl-2.5 pr-2 text-xs font-medium text-[#5C4A32] shadow-sm transition-all active:scale-95"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-[#C2B5A5] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 z-40 mt-1.5 w-52 overflow-hidden rounded-2xl border border-[#EFE5D3] bg-[#FFFDF0] shadow-xl"
          role="listbox"
        >
          <ul className="max-h-64 overflow-y-auto overscroll-contain py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, index) => {
              if (item.kind === "divider") {
                return (
                  <li
                    className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#C2B5A5]"
                    key={`divider-${item.label}-${index}`}
                  >
                    {item.label}
                  </li>
                );
              }

              const selected = value === item.value;
              return (
                <li key={item.value}>
                  <button
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "bg-[#F3ECE0] font-semibold text-[#8C6D53]"
                        : "text-[#5C4A32] hover:bg-[#F3ECE0] hover:text-[#8C6D53]"
                    }`}
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    role="option"
                    aria-selected={selected}
                    type="button"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#FFF6D9] text-[#8A5A12]">
                      {item.value === "ALL" ? (
                        <LayoutGrid className="size-3.5" />
                      ) : (
                        <CategoryIcon
                          category={item.value}
                          className="size-3.5"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {selected && (
                      <Check className="size-3.5 shrink-0 text-[#8C6D53]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
