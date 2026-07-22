"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Donut,
  MessageCircle,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const tabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "记账", icon: MessageCircle },
  { href: "/transactions", label: "账单", icon: ClipboardList },
  { href: "/charts", label: "统计", icon: Donut },
  { href: "/summary", label: "规划", icon: Wallet },
  { href: "/profile", label: "我的", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="z-50 shrink-0 bg-[#FAF6EC]/90 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+4px)] backdrop-blur-md shadow-[0_-4px_16px_rgba(92,74,50,0.03)]">
      <div className="grid grid-cols-5 px-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-0.5 text-[11px] transition-all active:scale-95 ${
                active
                  ? "font-semibold text-[#8C6D53]"
                  : "font-medium text-[#C2B5A5]"
              }`}
              href={href}
              key={href}
            >
              <Icon
                aria-hidden="true"
                className={`size-6 ${active ? "stroke-[2.25]" : "stroke-[1.75]"}`}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
