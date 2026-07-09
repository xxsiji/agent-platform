import { NextResponse } from "next/server";
import { streamText, convertToModelMessages, type UIMessage, isStepCount } from "ai";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deepseek } from "@/lib/ai/deepseek";
import { buildSystemPromptWithRag } from "@/lib/rag/prompt";
import { resolveTools } from "@/lib/tools";

/**
 * 流式对话 API · 核心
 *
 * POST /api/chat
 * Body: { messages: UIMessage[], agentId: string, threadId: string }
 *
 * 流程：
 * 1. 鉴权：检查当前用户是否登录
 * 2. 加载 Agent：验证所有权(只能跟自己的 Agent 对话)
 * 3. 验证 Thread：确保会话属于当前用户
 * 4. 存用户消息：把用户刚发的话存到 Message 表
 * 5. 流式生成：用 AI SDK streamText 调 DeepSeek，逐字返回
 * 6. 流结束(onFinish)：存 AI 回复 + 写用量记录
 *
 * AI SDK 7 关键变化：
 * - 客户端发的是 UIMessage[]（有 parts 数组），服务端要用 convertToModelMessages 转换
 * - 流式响应用 result.toUIMessageStreamResponse()（不是旧版的 toDataStreamResponse）
 * - usage 用 inputTokens / outputTokens（不是旧版的 promptTokens / completionTokens）
 */
export async function POST(request: Request) {
  // 1. 鉴权
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { messages, agentId, threadId } = body as {
    messages: UIMessage[];
    agentId: string;
    threadId: string;
  };

  // 2. 加载 Agent，验证所有权
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 3. 验证 Thread 归属
  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread || thread.userId !== currentUser.db.id) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  // 4. 存用户消息（最后一条是用户刚发的），同时取出纯文本作为 RAG 检索 query
  const lastMessage = messages[messages.length - 1];
  const userQuery =
    lastMessage && lastMessage.role === "user"
      ? lastMessage.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("")
      : "";

  if (userQuery) {
    await prisma.message.create({
      data: {
        threadId,
        role: "USER",
        content: userQuery,
      },
    });
  }

  // 4.5 RAG：如果该 Agent 有知识库，检索相关切片拼进 system prompt
  const systemPrompt = await buildSystemPromptWithRag(
    agentId,
    agent.systemPrompt,
    userQuery,
    agent.enableKnowledge
  );

  // 5. 工具解析：根据 Agent 配置的 tools 字段注入可用工具
  const { tools, hasTools } = resolveTools(agent.tools, process.env);

  // 6. 流式生成
  const result = streamText({
    model: deepseek.chat(agent.model),
    system: systemPrompt || undefined,
    messages: await convertToModelMessages(messages),
    temperature: agent.temperature,
    topP: agent.topP,
    maxOutputTokens: agent.maxTokens,

    // 工具调用：仅当配置了工具时注入；stopWhen 允许多步（调工具→看结果→继续答）
    ...(hasTools ? { tools, stopWhen: isStepCount(5) } : {}),

    // 7. 流结束后：存 AI 回复 + 写用量记录
    onFinish: async ({ text, usage }) => {
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const totalTokens = inputTokens + outputTokens;

      // 并行执行：存 AI 消息 + 写用量 + 更新会话时间 + Agent 对话数 +1
      await Promise.all([
        prisma.message.create({
          data: {
            threadId,
            role: "ASSISTANT",
            content: text,
            tokenCount: totalTokens,
          },
        }),
        prisma.usageRecord.create({
          data: {
            userId: currentUser.db.id,
            agentId,
            threadId,
            provider: "deepseek",
            model: agent.model,
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            totalTokens,
          },
        }),
        prisma.thread.update({
          where: { id: threadId },
          data: { updatedAt: new Date() },
        }),
        prisma.agent.update({
          where: { id: agentId },
          data: { conversationsCount: { increment: 1 } },
        }),
      ]);
    },
  });

  // 返回 UI 消息流（AI SDK 7 协议，前端 useChat 直接消费）
  return result.toUIMessageStreamResponse();
}
