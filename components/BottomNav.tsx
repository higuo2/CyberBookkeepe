"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Donut,
  Heart,
  MessageCircle,
  Settings,
  type LucideIcon,
} from "lucide-react";

const tabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "记账", icon: MessageCircle },
  { href: "/transactions", label: "账单", icon: ClipboardList },
  { href: "/charts", label: "统计", icon: Donut },
  { href: "/summary", label: "总结", icon: Heart },
  { href: "/profile", label: "我的", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="z-50 shrink-0 border-t border-[#EFE5D3] bg-[#FAF6EC]/90 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur-md">
      <div className="grid h-14 grid-cols-5 px-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all active:scale-95 ${
                active ? "text-[#8C6D53]" : "text-[#BFAFA0]"
              }`}
              href={href}
              key={href}
            >
              <Icon
                aria-hidden="true"
                className={`size-[1.2rem] ${active ? "stroke-[2.5]" : ""}`}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
