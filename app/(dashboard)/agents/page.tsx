import { cache } from "react";
import Link from "next/link";
import { Bot, Plus, MessageSquare, Settings, ArrowRight } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ShareButton } from "@/components/dashboard/share-button";

/**
 * 我的 Agent 列表页。
 *
 * 这是 Server Component——直接用 Prisma 查数据库，不需要 API。
 * Server Component 的优势：数据在服务端获取，不暴露到浏览器，SEO 友好。
 *
 * 数据隔离：只查 ownerId = 当前用户的 Agent，排除已软删除的。
 */
export default async function AgentsPage() {
  const currentUser = await getCurrentUser();

  // getCurrentUser 在 layout 里已经检查过了，这里做类型收窄
  if (!currentUser) return null;

  // cache() 仅同一次请求内去重（不跨用户、不串号），配合 P2 减少冗余往返。
  const getAgents = cache(async () => {
    return prisma.agent.findMany({
      where: {
        ownerId: currentUser.db.id,
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });
  });
  const agents = await getAgents();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* 页头 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">我的 Agent</h1>
          <p className="text-sm text-muted-foreground">
            创建、配置和管理你的 AI 智能体。
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/agents/new">
            <Plus className="size-4" />
            新建 Agent
          </Link>
        </Button>
      </div>

      {agents.length === 0 ? (
        /* 空状态 */
        <EmptyState
          icon={<Bot className="size-6" />}
          title="你还没有创建 Agent"
          description="Agent 是一个可配置的 AI 智能体，填写名称、系统提示词、选择模型即可获得专属对话助手。"
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/agents/new">
                创建第一个 Agent
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        /* Agent 卡片网格 */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="group flex flex-col gap-3 transition-shadow hover:shadow-md">
              <CardContent className="flex flex-1 flex-col gap-3 pt-6">
                {/* 头像 + 名称 */}
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground">{agent.model}</p>
                  </div>
                </div>

                {/* 描述 */}
                <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {agent.description || "暂无描述"}
                </p>

                {/* 统计 + 分享操作 */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="size-3" />
                    {agent.conversationsCount} 次对话
                  </span>
                  <ShareButton
                    agentId={agent.id}
                    initialIsPublic={agent.visibility === "PUBLIC"}
                    initialShareSlug={agent.shareSlug}
                  />
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 border-t pt-3">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/agents/${agent.id}/chat`}>
                      <MessageSquare className="size-4" />
                      对话
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/agents/${agent.id}/edit`}>
                      <Settings className="size-4" />
                      配置
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
