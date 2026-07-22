import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Compass } from "lucide-react";

import { getExploreData } from "@/lib/queries/explore";
import { ExploreAuthNav } from "@/components/explore/explore-auth-nav";
import { ExploreClient } from "@/components/explore/explore-client";

// 运行时动态渲染：避免 build 时静态预渲染去连数据库（Vercel build 环境连 Supabase 不稳定）
export const dynamic = "force-dynamic";

/**
 * 探索广场页面（免登录）。
 *
 * 路由：/explore
 *
 * 这是 Server Component：
 * 1. 在服务端查询第一页热门 Agent + 标签列表，传给客户端组件做首屏渲染。
 *    这样页面打开就有内容（不用等客户端 JS 加载完再请求），对 SEO 也友好。
 * 2. 导出 metadata，让搜索引擎能收录这个页面。
 * 3. 页头：Logo + 登录/注册按钮（未登录）或工作台入口（已登录）。
 *
 * 路由组 (public)：不继承 dashboard 的侧边栏布局，也不需要登录。
 */
export const metadata: Metadata = {
  title: "探索 Agent · Agent 智能体平台",
  description: "发现社区创建的 AI 智能体，直接体验对话",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "探索 Agent · Agent 智能体平台",
    description: "发现社区创建的 AI 智能体，直接体验对话",
    type: "website",
    siteName: "Agent 智能体平台",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
};

export default async function ExplorePage() {
  // 数据走缓存函数（无用户依赖），让整页保持 static + 60s 重校验，
  // 不被 cookie 拖成 dynamic（登录态 UI 见 <ExploreAuthNav /> 的解耦说明）。
  const { agents, total, tags } = await getExploreData();

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      {/* 页头 */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="text-base font-semibold">Agent 平台</span>
          </Link>
          <ExploreAuthNav />
        </div>
      </header>

      {/* 主体内容 */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {/* 标题 */}
        <div className="mb-8 flex items-center gap-3">
          <Compass className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">探索广场</h1>
            <p className="text-sm text-muted-foreground">
              发现社区创建的 AI 智能体，直接体验对话
            </p>
          </div>
        </div>

        {/* 交互组件：搜索 + 排序 + 标签筛选 + 卡片网格 */}
        <ExploreClient
          initialAgents={agents}
          initialTotal={total}
          initialTags={tags}
        />
      </main>
    </div>
  );
}
