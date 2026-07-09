import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * 评论 API
 *
 * GET  /api/agents/[id]/comments?page=1  — 评论列表(分页,免登录可看)
 * POST /api/agents/[id]/comments         — 发表评论/回复(需登录)
 *
 * 评论结构：两层
 * - 顶级评论：parentId = null
 * - 回复：parentId = 某条顶级评论的 id（不能回复回复）
 */

// ---------------------------------------------------------------------------
// GET: 评论列表
// ---------------------------------------------------------------------------
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 检查 Agent 是否公开
  const agent = await prisma.agent.findUnique({
    where: { id },
    select: { visibility: true, deletedAt: true },
  });

  if (!agent || agent.visibility !== "PUBLIC" || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 分页参数
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = 20;

  // 查顶级评论（parentId=null），按创建时间倒序
  const [total, topComments] = await Promise.all([
    prisma.comment.count({
      where: { agentId: id, parentId: null },
    }),
    prisma.comment.findMany({
      where: { agentId: id, parentId: null },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // 关联查询：作者信息 + 该评论下的回复
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    comments: topComments,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

// ---------------------------------------------------------------------------
// POST: 发表评论/回复
// ---------------------------------------------------------------------------
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

  // 2. 检查 Agent
  const agent = await prisma.agent.findUnique({
    where: { id },
    select: { visibility: true, deletedAt: true },
  });

  if (!agent || agent.visibility !== "PUBLIC" || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 3. 解析请求体
  const body = await request.json();
  const { content, parentId } = body as { content: string; parentId?: string };

  // 4. 校验 content
  const trimmed = content?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
  }
  if (trimmed.length > 500) {
    return NextResponse.json({ error: "评论不能超过 500 字" }, { status: 400 });
  }

  // 5. 如果是回复，校验 parentId
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { parentId: true, agentId: true },
    });

    if (!parent) {
      return NextResponse.json({ error: "被回复的评论不存在" }, { status: 404 });
    }

    // 回复必须属于同一个 Agent
    if (parent.agentId !== id) {
      return NextResponse.json({ error: "评论不属于该 Agent" }, { status: 400 });
    }

    // 约束：parentId 只能指向顶级评论（parent 的 parentId 必须是 null）
    if (parent.parentId !== null) {
      return NextResponse.json(
        { error: "不能回复回复，只能回复顶级评论" },
        { status: 400 }
      );
    }
  }

  // 6. 创建评论
  const comment = await prisma.comment.create({
    data: {
      content: trimmed,
      userId: currentUser.db.id,
      agentId: id,
      parentId: parentId || null,
    },
    include: {
      user: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
