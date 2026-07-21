import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "CyberBookkeeper",
  description: "AI 驱动的私人智能账本",
  applicationName: "CyberBookkeeper",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CyberBookkeeper",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

/** Generates: width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFFDF0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className="h-dvh overflow-x-hidden" lang="zh-CN">
      <body className="h-dvh overflow-x-hidden touch-pan-y overscroll-none">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
