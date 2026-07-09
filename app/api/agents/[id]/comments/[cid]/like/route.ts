import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * 评论点赞 API · 切换(toggle)
 *
 * POST /api/agents/[id]/comments/[cid]/like
 *
 * 逻辑跟 Agent 点赞一样：
 * - 已赞 → 删 CommentLike + comment.likeCount-1
 * - 未赞 → 建 CommentLike + comment.likeCount+1
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  // 1. 鉴权
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id, cid } = await params;

  // 2. 检查评论是否存在 + 属于该 Agent
  const comment = await prisma.comment.findUnique({
    where: { id: cid },
    select: { agentId: true, deletedAt: true },
  });

  if (!comment || comment.agentId !== id) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }

  // 3. 查是否已点赞
  const existing = await prisma.commentLike.findUnique({
    where: {
      userId_commentId: {
        userId: currentUser.db.id,
        commentId: cid,
      },
    },
  });

  if (existing) {
    // 已赞 → 取消
    await prisma.$transaction([
      prisma.commentLike.delete({
        where: {
          userId_commentId: {
            userId: currentUser.db.id,
            commentId: cid,
          },
        },
      }),
      prisma.comment.update({
        where: { id: cid },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);

    const updated = await prisma.comment.findUnique({
      where: { id: cid },
      select: { likeCount: true },
    });

    return NextResponse.json({ liked: false, likeCount: updated?.likeCount ?? 0 });
  } else {
    // 未赞 → 点赞
    await prisma.$transaction([
      prisma.commentLike.create({
        data: {
          userId: currentUser.db.id,
          commentId: cid,
        },
      }),
      prisma.comment.update({
        where: { id: cid },
        data: { likeCount: { increment: 1 } },
      }),
    ]);

    const updated = await prisma.comment.findUnique({
      where: { id: cid },
      select: { likeCount: true },
    });

    return NextResponse.json({ liked: true, likeCount: updated?.likeCount ?? 0 });
  }
}
