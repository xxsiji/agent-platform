import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Agent API · 列表 + 创建
 *
 * GET  /api/agents     → 获取当前用户的 Agent 列表(不含已软删除的)
 * POST /api/agents     → 创建新 Agent
 *
 * 所有接口都需要登录——getCurrentUser() 会检查 Cookie 里的 session。
 * 数据隔离：只能看到/操作自己创建的 Agent(ownerId = 当前用户)。
 */

// GET /api/agents — 我的 Agent 列表
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    where: {
      ownerId: currentUser.db.id,
      deletedAt: null, // 排除已软删除的
    },
    orderBy: { updatedAt: "desc" },
    // 只返回需要的字段，不返回敏感的系统提示词全文(列表页不需要)
    select: {
      id: true,
      name: true,
      description: true,
      avatarUrl: true,
      model: true,
      visibility: true,
      status: true,
      conversationsCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(agents);
}

// POST /api/agents — 创建 Agent
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();

  // 基本校验：名称必填
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Agent 名称不能为空" }, { status: 400 });
  }

  // 创建 Agent，ownerId 绑定当前用户
  const agent = await prisma.agent.create({
    data: {
      ownerId: currentUser.db.id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      systemPrompt: body.systemPrompt?.trim() || null,
      model: body.model || "deepseek-chat",
      temperature: body.temperature ?? 0.7,
      topP: body.topP ?? 1,
      maxTokens: body.maxTokens ?? 2048,
    },
  });

  // 处理标签：对每个标签名 upsert Tag 记录，然后创建 AgentTag 关联
  if (body.tags && Array.isArray(body.tags)) {
    const tagNames = body.tags
      .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean)
      .slice(0, 5); // 最多 5 个标签

    if (tagNames.length > 0) {
      // upsert：标签存在就复用，不存在就创建
      const tagRecords = await Promise.all(
        tagNames.map((name: string) =>
          prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          })
        )
      );
      // 创建 Agent-Tag 关联
      await prisma.agentTag.createMany({
        data: tagRecords.map((t) => ({ agentId: agent.id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json(agent, { status: 201 });
}
