import { NextResponse } from "next/server";
import { streamText, convertToModelMessages, type UIMessage, isStepCount } from "ai";

import { prisma } from "@/lib/prisma";
import { deepseek } from "@/lib/ai/deepseek";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { buildSystemPromptWithRag } from "@/lib/rag/prompt";
import { resolveTools } from "@/lib/tools";

/**
 * 公开对话 API · 访客态(免登录)
 *
 * POST /api/public/agents/[slug]/chat
 * Body: { messages: UIMessage[] }
 *
 * 跟 /api/chat 的区别：
 * 1. 不需要登录——任何人都能用
 * 2. 用 shareSlug 查 Agent(而不是 agentId)，且只查 visibility=PUBLIC 的
 * 3. 限流——按 IP 限制(20 次/小时)，防止滥用
 * 4. 不存 Thread/Message——访客没有账号，无法关联。客户端 useChat 在本地维护历史
 * 5. 但要存 UsageRecord——让 owner 看到公开对话的 token 消耗
 *
 * 脱敏：Agent 的 systemPrompt 只在服务端用，不返回给客户端
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // 1. 限流：按 IP，20 次/小时
  const ip = getClientIP(request);
  const limit = rateLimit(`public-chat:${ip}`, { max: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.success) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "请求过于频繁，请稍后再试",
          resetAt: new Date(limit.resetAt).toISOString(),
        },
      },
      { status: 429 }
    );
  }

  // 2. 用 slug 查公开 Agent
  const agent = await prisma.agent.findUnique({
    where: { shareSlug: slug },
  });

  // 不存在 / 未公开 / 已软删除 → 404
  if (!agent || agent.visibility !== "PUBLIC" || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在或未公开" }, { status: 404 });
  }

  const body = await request.json();
  const { messages } = body as { messages: UIMessage[] };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  // 3. RAG：取最后一条用户消息作为 query，有知识库则检索注入
  const lastMessage = messages[messages.length - 1];
  const userQuery =
    lastMessage && lastMessage.role === "user"
      ? lastMessage.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("")
      : "";

  const systemPrompt = await buildSystemPromptWithRag(
    agent.id,
    agent.systemPrompt,
    userQuery,
    agent.enableKnowledge
  );

  // 4. 工具解析：根据 Agent 配置的 tools 字段注入可用工具
  const { tools, hasTools } = resolveTools(agent.tools, process.env);

  // 5. 流式生成(跟 /api/chat 一样，但不存用户消息——没有 Thread)
  const result = streamText({
    model: deepseek.chat(agent.model),
    system: systemPrompt || undefined,
    messages: await convertToModelMessages(messages),
    temperature: agent.temperature,
    topP: agent.topP,
    maxOutputTokens: agent.maxTokens,

    // 工具调用：仅当配置了工具时注入；stopWhen 允许多步
    ...(hasTools ? { tools, stopWhen: isStepCount(5) } : {}),

    // 5. 流结束：记用量 + 对话计数(不存 Message，因为没有 Thread)
    onFinish: async ({ usage }) => {
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const totalTokens = inputTokens + outputTokens;

      await Promise.all([
        // 记用量(userId = Agent owner，让 owner 能看到公开消耗)
        prisma.usageRecord.create({
          data: {
            userId: agent.ownerId,
            agentId: agent.id,
            threadId: null,
            provider: "deepseek",
            model: agent.model,
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            totalTokens,
          },
        }),
        // 对话次数 +1
        prisma.agent.update({
          where: { id: agent.id },
          data: { conversationsCount: { increment: 1 } },
        }),
      ]);
    },
  });

  return result.toUIMessageStreamResponse();
}
