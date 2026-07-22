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
    <html
      className="font-app-rounded min-h-screen overflow-x-hidden bg-[#F6F4EE] antialiased"
      data-font-style="rounded"
      lang="zh-CN"
    >
      <head>
        {/* next/font 的 Noto Serif SC 无中文 subset；用 Google CSS 拉取 CJK unicode-range */}
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com"
          rel="preconnect"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-[#F6F4EE] text-[#3A322B] antialiased touch-pan-y overscroll-none">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
