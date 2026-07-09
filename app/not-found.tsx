import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileX2 } from "lucide-react";

/**
 * 全局 404 页面。
 * 访问不存在的路由（如 /share/不存在的slug 触发 notFound()）时展示。
 */
export const metadata: Metadata = {
  title: "页面不存在 · Agent 智能体平台",
  description: "你访问的页面不存在",
  openGraph: {
    title: "页面不存在 · Agent 智能体平台",
    description: "你访问的页面不存在",
    type: "website",
    siteName: "Agent 智能体平台",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
};

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileX2 className="size-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">页面不存在</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          你访问的页面可能已被删除或从未存在。
        </p>
      </div>
      <Button asChild>
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}
