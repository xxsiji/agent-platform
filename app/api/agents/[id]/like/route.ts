import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * 点赞 API · 切换(toggle)
 *
 * POST /api/agents/[id]/like
 *
 * 逻辑：
 * 1. 必须登录
 * 2. Agent 必须是 PUBLIC 且未删除
 * 3. 查 AgentLike：有 → 删除 + likeCount-1（取消赞）
 *                   没有 → 创建 + likeCount+1（点赞）
 * 4. 联合主键 @@id([userId, agentId]) 保证不会重复插入
 *
 * 返回：{ liked: boolean, likeCount: number }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. 鉴权
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  // 2. 查 Agent：必须是公开的、未删除的
  const agent = await prisma.agent.findUnique({
    where: { id },
    select: { visibility: true, deletedAt: true },
  });

  if (!agent || agent.visibility !== "PUBLIC" || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在或不可互动" }, { status: 404 });
  }

  // 3. 查是否已点赞
  const existing = await prisma.agentLike.findUnique({
    where: {
      userId_agentId: {
        userId: currentUser.db.id,
        agentId: id,
      },
    },
  });

  if (existing) {
    // 已赞 → 取消赞
    await prisma.$transaction([
      prisma.agentLike.delete({
        where: {
          userId_agentId: {
            userId: currentUser.db.id,
            agentId: id,
          },
        },
      }),
      prisma.agent.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);

    const updated = await prisma.agent.findUnique({
      where: { id },
      select: { likeCount: true },
    });

    return NextResponse.json({ liked: false, likeCount: updated?.likeCount ?? 0 });
  } else {
    // 未赞 → 点赞
    await prisma.$transaction([
      prisma.agentLike.create({
        data: {
          userId: currentUser.db.id,
          agentId: id,
        },
      }),
      prisma.agent.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
      }),
    ]);

    const updated = await prisma.agent.findUnique({
      where: { id },
      select: { likeCount: true },
    });

    return NextResponse.json({ liked: true, likeCount: updated?.likeCount ?? 0 });
  }
}
