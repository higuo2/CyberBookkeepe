import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const CREAM = "#F6F4EE";

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
    icon: [{ url: "/icons/icon.png", type: "image/png" }],
    apple: [{ url: "/icons/icon.png", type: "image/png" }],
  },
  other: {
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

/** Generates viewport-fit=cover + theme-color for iOS Safari chrome */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: CREAM,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className="min-h-screen overflow-x-hidden bg-[#F6F4EE] antialiased" lang="zh-CN">
      <body className="min-h-screen overflow-x-hidden bg-[#F6F4EE] text-[#3A322B] antialiased touch-pan-y overscroll-none">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
