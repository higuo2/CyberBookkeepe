"use client";

import { Toaster } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="mx-auto min-h-dvh max-w-lg bg-stone-50 pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav />
      <Toaster
        closeButton
        position="top-center"
        richColors
        toastOptions={{ className: "font-sans" }}
      />
    </AuthGate>
  );
}
