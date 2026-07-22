import type { ReactNode } from "react";

/** Shared tab-page header — caption / title / description hierarchy */
export function PageHeader({
  caption,
  title,
  description,
  actions,
  className = "",
}: {
  caption: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`shrink-0 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#8C8273]">{caption}</p>
          <h1 className="mt-0.5 text-2xl font-bold text-[#3A322B]">{title}</h1>
          {description ? (
            <p className="mt-1 text-xs text-[#8C8273]">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 pt-0.5">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
