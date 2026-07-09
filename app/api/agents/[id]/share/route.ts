import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * 转发 API · 计数+1
 *
 * POST /api/agents/[id]/share
 *
 * 逻辑最简单：只要登录了 + Agent 是公开的，就 shareCount+1。
 * MVP 不接微信/微博 SDK，前端弹个面板让用户复制链接即可。
 *
 * 返回：{ shareCount: number }
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

  // 3. 转发计数+1
  const updated = await prisma.agent.update({
    where: { id },
    data: { shareCount: { increment: 1 } },
    select: { shareCount: true },
  });

  return NextResponse.json({ shareCount: updated.shareCount });
}
