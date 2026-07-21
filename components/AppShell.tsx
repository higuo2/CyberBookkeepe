"use client";

import { Toaster } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-x-hidden bg-[#FFFDF0] touch-pan-y sm:border-x sm:border-[#F0E6C8] sm:shadow-[0_0_48px_rgba(92,74,50,0.08)]">
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
  );
}
