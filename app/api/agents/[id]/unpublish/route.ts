import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * 撤回 Agent 公开
 *
 * POST /api/agents/[id]/unpublish
 *
 * 做两件事：
 * 1. 设置 visibility = PRIVATE
 * 2. 清除 shareSlug（让旧链接彻底失效，不是 404 而是找不到）
 *
 * 撤回后，之前分享的 /share/:slug 链接将不再可用。
 * 只有 owner 能撤回自己的 Agent。
 */
export async function POST(
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

  // 撤回：设为 PRIVATE + 清除 slug
  await prisma.agent.update({
    where: { id },
    data: {
      visibility: "PRIVATE",
      shareSlug: null,
    },
  });

  return NextResponse.json({ success: true });
}
