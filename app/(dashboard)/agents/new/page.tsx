import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AgentForm } from "@/components/dashboard/agent-form";

/**
 * 新建 Agent 页面。
 *
 * 纯包装页面——实际表单逻辑在 AgentForm 组件里。
 * 不传 agent 属性 → AgentForm 进入"创建模式"。
 */
export const metadata: Metadata = {
  title: "创建 Agent · Agent 智能体平台",
  description: "配置你的专属 AI Agent 并一键分享",
  robots: { index: false, follow: false },
  openGraph: {
    title: "创建 Agent · Agent 智能体平台",
    description: "配置你的专属 AI Agent 并一键分享",
    type: "website",
    siteName: "Agent 智能体平台",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
};

export default function NewAgentPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/agents">
            <ArrowLeft className="size-4" />
            返回
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">新建 Agent</h1>
          <p className="text-sm text-muted-foreground">
            配置你的 AI 智能体，创建后即可开始对话。
          </p>
        </div>
      </div>

      <AgentForm />
    </div>
  );
}
