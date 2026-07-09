import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * 收藏 API · 切换(toggle)
 *
 * POST /api/agents/[id]/favorite
 *
 * 逻辑跟点赞完全一样，只是操作的表从 AgentLike 换成 AgentFavorite，
 * 计数字段从 likeCount 换成 favoriteCount。
 *
 * 返回：{ favorited: boolean, favoriteCount: number }
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

  // 3. 查是否已收藏
  const existing = await prisma.agentFavorite.findUnique({
    where: {
      userId_agentId: {
        userId: currentUser.db.id,
        agentId: id,
      },
    },
  });

  if (existing) {
    // 已收藏 → 取消收藏
    await prisma.$transaction([
      prisma.agentFavorite.delete({
        where: {
          userId_agentId: {
            userId: currentUser.db.id,
            agentId: id,
          },
        },
      }),
      prisma.agent.update({
        where: { id },
        data: { favoriteCount: { decrement: 1 } },
      }),
    ]);

    const updated = await prisma.agent.findUnique({
      where: { id },
      select: { favoriteCount: true },
    });

    return NextResponse.json({ favorited: false, favoriteCount: updated?.favoriteCount ?? 0 });
  } else {
    // 未收藏 → 收藏
    await prisma.$transaction([
      prisma.agentFavorite.create({
        data: {
          userId: currentUser.db.id,
          agentId: id,
        },
      }),
      prisma.agent.update({
        where: { id },
        data: { favoriteCount: { increment: 1 } },
      }),
    ]);

    const updated = await prisma.agent.findUnique({
      where: { id },
      select: { favoriteCount: true },
    });

    return NextResponse.json({ favorited: true, favoriteCount: updated?.favoriteCount ?? 0 });
  }
}
