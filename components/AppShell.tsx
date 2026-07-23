"use client";

import { Toaster } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { BottomNav } from "@/components/BottomNav";
import { LocaleProvider } from "@/components/LocaleProvider";
import { RecurringAutoSync } from "@/components/RecurringAutoSync";
import { FontProvider } from "@/context/FontContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <FontProvider>
      <LocaleProvider>
        <AuthGate>
          <RecurringAutoSync />
          <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-x-hidden bg-[var(--color-bg-main)] touch-pan-y sm:border-x sm:border-[var(--color-border)] sm:shadow-[0_0_48px_rgba(60,50,40,0.05)]">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
            <BottomNav />
          </div>
          <Toaster
            closeButton
            offset="calc(env(safe-area-inset-top) + 12px)"
            position="top-center"
            richColors
            toastOptions={{ className: "font-sans" }}
          />
        </AuthGate>
      </LocaleProvider>
    </FontProvider>
  );
}
