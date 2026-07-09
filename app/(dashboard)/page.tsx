import type { Metadata } from "next";
import Link from "next/link";
import { Bot, MessageSquare, Coins, Globe, Plus, ArrowRight, Compass } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * 工作台首页：用量概览 + 我的 Agent + 快速开始。
 *
 * Server Component：直接查数据库获取真实数据。
 */
export const metadata: Metadata = {
  title: "工作台 · Agent 智能体平台",
  description: "管理你的 AI Agent、查看用量与互动数据",
  robots: { index: false, follow: false },
  openGraph: {
    title: "工作台 · Agent 智能体平台",
    description: "管理你的 AI Agent、查看用量与互动数据",
    type: "website",
    siteName: "Agent 智能体平台",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
};

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  // 查真实数据
  const [agentCount, publicCount, usageRecords] = await Promise.all([
    prisma.agent.count({
      where: { ownerId: currentUser.db.id, deletedAt: null },
    }),
    prisma.agent.count({
      where: {
        ownerId: currentUser.db.id,
        visibility: "PUBLIC",
        deletedAt: null,
      },
    }),
    prisma.usageRecord.findMany({
      where: { userId: currentUser.db.id },
      select: { totalTokens: true, createdAt: true },
    }),
  ]);

  // 本月 token 消耗
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTokens = usageRecords
    .filter((r) => r.createdAt >= monthStart)
    .reduce((sum, r) => sum + r.totalTokens, 0);

  const stats = [
    { label: "Agent 总数", value: String(agentCount), icon: Bot, hint: "已创建的智能体" },
    { label: "本月对话", value: "—", icon: MessageSquare, hint: "会话轮次" },
    { label: "Token 消耗", value: monthTokens > 0 ? monthTokens.toLocaleString() : "—", icon: Coins, hint: "本月累计" },
    { label: "公开分享", value: String(publicCount), icon: Globe, hint: "已发布的 Agent" },
  ];

  // 最近的 Agent(最多 3 个)
  const recentAgents = await prisma.agent.findMany({
    where: { ownerId: currentUser.db.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { id: true, name: true, description: true, model: true },
  });

  const templates = [
    { name: "翻译助手", desc: "中英互译，支持多种语言自动检测" },
    { name: "客服机器人", desc: "根据知识库回答常见问题" },
    { name: "写作助手", desc: "润色、扩写、改写各类文案" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* 页头 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">工作台</h1>
          <p className="text-sm text-muted-foreground">
            管理你的 AI Agent，查看用量与分享情况。
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/explore">
            <Compass className="size-4" />
            探索广场
          </Link>
        </Button>
      </div>

      {/* 用量概览 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="gap-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardDescription>{s.label}</CardDescription>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-xl tabular-nums sm:text-2xl">{s.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 我的 Agent + 快速开始 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 我的 Agent */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>我的 Agent</CardTitle>
              <CardDescription>最近使用的智能体</CardDescription>
            </div>
            <Button asChild size="sm">
              <Link href="/agents/new">
                <Plus className="size-4" />
                新建 Agent
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Bot className="size-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">还没有 Agent</p>
                  <p className="text-xs text-muted-foreground">
                    创建你的第一个 AI 智能体，配置人设与模型后即可对话。
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-1">
                  <Link href="/agents/new">
                    开始创建
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentAgents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}/chat`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{agent.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {agent.description || agent.model}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
                <Link
                  href="/agents"
                  className="pt-1 text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  查看全部 →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快速开始模板 */}
        <Card>
          <CardHeader>
            <CardTitle>快速开始</CardTitle>
            <CardDescription>从模板创建，省去配置</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {templates.map((t) => (
              <Link
                key={t.name}
                href="/agents/new"
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
