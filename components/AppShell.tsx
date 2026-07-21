"use client";

import { Toaster } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="mx-auto min-h-dvh max-w-lg bg-[#FAF6EC] pb-20">
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
