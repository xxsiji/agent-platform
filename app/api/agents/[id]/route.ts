import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Agent API · 单个 Agent 操作
 *
 * GET    /api/agents/[id]  → 获取详情(仅 owner)
 * PATCH  /api/agents/[id]  → 更新配置(仅 owner)
 * DELETE /api/agents/[id]  → 软删除(仅 owner)
 *
 * Next.js 16 关键变化：params 是 Promise，必须 await！
 * (Next.js 15 之前 params 是普通对象)
 */

// GET /api/agents/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id },
  });

  // 不存在 或 不是本人的 → 404(不暴露存在性)
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

// PATCH /api/agents/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // 先查 Agent，确认所有权
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 更新——只更新传入的字段
  const updated = await prisma.agent.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? agent.name,
      description: body.description !== undefined ? (body.description?.trim() || null) : agent.description,
      systemPrompt: body.systemPrompt !== undefined ? (body.systemPrompt?.trim() || null) : agent.systemPrompt,
      avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : agent.avatarUrl,
      model: body.model ?? agent.model,
      temperature: body.temperature ?? agent.temperature,
      topP: body.topP ?? agent.topP,
      maxTokens: body.maxTokens ?? agent.maxTokens,
      visibility: body.visibility ?? agent.visibility,
      enableKnowledge: body.enableKnowledge ?? agent.enableKnowledge,
      // 工具配置：string[]（如 ["web_search","calculator"]）或 null（全不选）
      tools: body.tools !== undefined ? body.tools : agent.tools,
    },
  });

  // 处理标签更新：如果传了 tags 字段，先删旧关联再建新的
  if (body.tags !== undefined && Array.isArray(body.tags)) {
    // 删除旧的 AgentTag 关联
    await prisma.agentTag.deleteMany({ where: { agentId: id } });

    const tagNames = body.tags
      .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean)
      .slice(0, 5);

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
      await prisma.agentTag.createMany({
        data: tagRecords.map((t) => ({ agentId: id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json(updated);
}

// DELETE /api/agents/[id] — 软删除(不真删，设 deletedAt)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 软删除：只标记 deletedAt，数据还在库里(30 天内可恢复)
  await prisma.agent.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
