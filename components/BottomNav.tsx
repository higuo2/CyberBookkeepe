"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Edit,
  PieChart,
  Receipt,
  SlidersHorizontal,
  SquarePen,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/components/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";

type Tab = {
  href: string;
  labelKey: MessageKey;
  outline: LucideIcon;
  solid: LucideIcon;
};

const tabs: Tab[] = [
  { href: "/", labelKey: "nav.record", outline: SquarePen, solid: Edit },
  {
    href: "/transactions",
    labelKey: "nav.transactions",
    outline: Receipt,
    solid: Receipt,
  },
  { href: "/charts", labelKey: "nav.charts", outline: PieChart, solid: PieChart },
  { href: "/summary", labelKey: "nav.planner", outline: Target, solid: Target },
  {
    href: "/profile",
    labelKey: "nav.settings",
    outline: SlidersHorizontal,
    solid: SlidersHorizontal,
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="z-50 shrink-0 border-t border-[#EAE5D9]/60 bg-[#F6F4EE]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <div className="flex h-[60px] items-center justify-around px-2">
        {tabs.map(({ href, labelKey, outline: Outline, solid: Solid }) => {
          const active =
            href === "/" ? pathname === href : pathname.startsWith(href);
          const Icon = active ? Solid : Outline;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-1 py-1 transition-all duration-200 active:scale-90"
              href={href}
              key={href}
            >
              <span
                className={`transition-all duration-200 ${
                  active
                    ? "rounded-full bg-[#F0ECE1] px-3 py-0.5"
                    : "rounded-full px-3 py-0.5"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={active ? 2.25 : 1.75}
                />
              </span>
              <span
                className={`text-[10px] tracking-tight transition-all duration-200 ${
                  active
                    ? "font-bold text-[#2C2420]"
                    : "font-medium text-[#9C9285]"
                }`}
              >
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
