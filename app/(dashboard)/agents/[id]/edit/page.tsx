import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AgentForm } from "@/components/dashboard/agent-form";
import { KnowledgeBasePanel } from "@/components/dashboard/knowledge-base-panel";
import { ToolsPanel } from "@/components/dashboard/tools-panel";

/**
 * 编辑 Agent 页面。
 *
 * Server Component：在服务端加载 Agent 数据，确认所有权后传给表单组件。
 * 传入 agent 属性 → AgentForm 进入"编辑模式"。
 *
 * Next.js 16：params 是 Promise，必须 await。
 */
export const metadata: Metadata = {
  title: "编辑 Agent · Agent 智能体平台",
  description: "修改你的 AI Agent 配置、人设与模型",
  robots: { index: false, follow: false },
  openGraph: {
    title: "编辑 Agent · Agent 智能体平台",
    description: "修改你的 AI Agent 配置、人设与模型",
    type: "website",
    siteName: "Agent 智能体平台",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
};

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const { id } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  // 不存在 / 不是本人的 / 已删除 → 404
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    notFound();
  }

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
          <h1 className="text-2xl font-semibold tracking-tight">编辑 Agent</h1>
          <p className="text-sm text-muted-foreground">
            修改「{agent.name}」的配置。
          </p>
        </div>
      </div>

      <AgentForm
        agent={{
          id: agent.id,
          name: agent.name,
          description: agent.description ?? "",
          systemPrompt: agent.systemPrompt ?? "",
          model: agent.model,
          temperature: agent.temperature,
          topP: agent.topP,
          maxTokens: agent.maxTokens,
          tags: agent.tags.map((t) => t.tag.name),
        }}
      />

      <KnowledgeBasePanel
        agentId={agent.id}
        initialEnableKnowledge={agent.enableKnowledge}
      />

      <ToolsPanel
        agentId={agent.id}
        initialTools={(agent.tools as string[] | null) ?? []}
      />
    </div>
  );
}
