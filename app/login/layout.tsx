import type { Metadata } from "next";

/**
 * 登录页布局（服务端组件）。
 *
 * app/login/page.tsx 是客户端组件（"use client"），无法导出 metadata。
 * 因此把登录页的 SEO 元数据放到同段 layout 中，由 Next.js 自动合并进 <head>。
 *
 * 登录页属于私有入口，设置 noindex 避免被搜索引擎收录。
 */
export const metadata: Metadata = {
  title: "登录 · Agent 智能体平台",
  description: "登录后创建、配置与分享你的 AI Agent",
  robots: { index: false, follow: false },
  openGraph: {
    title: "登录 · Agent 智能体平台",
    description: "登录后创建、配置与分享你的 AI Agent",
    type: "website",
    siteName: "Agent 智能体平台",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
