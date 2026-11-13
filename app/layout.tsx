import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "理想创作者服务平台",
  description: "按周统计已上报笔记，追踪积分到账。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
