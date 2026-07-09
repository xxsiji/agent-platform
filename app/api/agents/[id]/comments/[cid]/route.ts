import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * 删除评论 API · 软删除
 *
 * DELETE /api/agents/[id]/comments/[cid]
 *
 * 逻辑：
 * 1. 必须登录
 * 2. 只能删自己的评论
 * 3. 软删除：设 deletedAt = now()，不真正删行
 *    前端显示"该评论已删除"，保留楼层结构
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  // 1. 鉴权
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id, cid } = await params;

  // 2. 查评论
  const comment = await prisma.comment.findUnique({
    where: { id: cid },
    select: { userId: true, agentId: true, deletedAt: true },
  });

  if (!comment || comment.agentId !== id) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }

  // 3. 权限：只能删自己的评论
  if (comment.userId !== currentUser.db.id) {
    return NextResponse.json({ error: "无权删除他人的评论" }, { status: 403 });
  }

  // 4. 已经软删除了就不用重复操作
  if (comment.deletedAt) {
    return NextResponse.json({ error: "评论已删除" }, { status: 400 });
  }

  // 5. 软删除
  await prisma.comment.update({
    where: { id: cid },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
