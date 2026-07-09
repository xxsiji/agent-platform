import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/dashboard/chat";
import type { UIMessage } from "ai";

/**
 * 对话页（Server Component）。
 *
 * 职责：
 * 1. 验证 Agent 归属
 * 2. 找到/创建 Thread（每个 Agent + 用户 对应一个最新会话）
 * 3. 从数据库加载历史消息，转成 UIMessage 格式传给客户端
 *
 * 为什么不在客户端做这些？因为服务端可以直接访问数据库，
 * 不需要额外 API 请求，且数据不暴露到浏览器。
 */
export const metadata: Metadata = {
  title: "与 Agent 对话 · Agent 智能体平台",
  description: "与你的 AI Agent 进行实时对话",
  robots: { index: false, follow: false },
  openGraph: {
    title: "与 Agent 对话 · Agent 智能体平台",
    description: "与你的 AI Agent 进行实时对话",
    type: "website",
    siteName: "Agent 智能体平台",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
};

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const { id: agentId } = await params;

  // 1. 验证 Agent 归属
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    notFound();
  }

  // 2. 找到最新的 Thread，没有就创建一个
  let thread = await prisma.thread.findFirst({
    where: { agentId, userId: currentUser.db.id },
    orderBy: { updatedAt: "desc" },
  });

  if (!thread) {
    thread = await prisma.thread.create({
      data: {
        agentId,
        userId: currentUser.db.id,
        title: agent.name,
      },
    });
  }

  // 3. 加载历史消息
  const dbMessages = await prisma.message.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
  });

  // 转成 AI SDK 7 的 UIMessage 格式
  // UIMessage 用 parts 数组表示内容，文本消息的 part 是 { type: 'text', text: '...' }
  const initialMessages: UIMessage[] = dbMessages.map((m) => ({
    id: m.id,
    role: m.role === "USER" ? "user" : "assistant",
    parts: [{ type: "text", text: m.content }],
  }));

  return (
    <div className="mx-auto flex h-[calc(100dvh-6rem)] w-full max-w-3xl flex-col gap-4 md:h-[calc(100dvh-4rem)]">
      {/* 页头：手机端只留「返回 + 名字」，model 小字与配置按钮在 sm: 以上显示 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/agents">
              <ArrowLeft className="size-4" />
              返回
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {agent.name}
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {agent.model}
            </p>
          </div>
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden shrink-0 sm:inline-flex"
        >
          <Link href={`/agents/${agentId}/edit`}>
            <Settings className="size-4" />
            配置
          </Link>
        </Button>
      </div>

      {/* 聊天界面 */}
      <Chat
        agentId={agentId}
        threadId={thread.id}
        agentName={agent.name}
        systemPrompt={agent.systemPrompt}
        initialMessages={initialMessages}
      />
    </div>
  );
}
