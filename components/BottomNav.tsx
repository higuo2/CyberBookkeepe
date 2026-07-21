"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartPie, List, NotebookPen, type LucideIcon } from "lucide-react";

const tabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "记账", icon: NotebookPen },
  { href: "/transactions", label: "明细", icon: List },
  { href: "/charts", label: "图表", icon: ChartPie },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid h-17 max-w-lg grid-cols-3 px-3">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                active ? "text-emerald-600" : "text-stone-400"
              }`}
              href={href}
              key={href}
            >
              <Icon
                aria-hidden="true"
                className={`size-5 ${active ? "stroke-[2.5]" : ""}`}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
