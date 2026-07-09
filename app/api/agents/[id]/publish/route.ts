import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateShareSlug } from "@/lib/share";

/**
 * 发布 Agent 为公开
 *
 * POST /api/agents/[id]/publish
 * Body: { slug?: string }  // 可选自定义 slug，为空则自动生成
 *
 * 做两件事：
 * 1. 生成唯一 shareSlug（如果用户没传自定义的）
 * 2. 设置 visibility = PUBLIC
 *
 * 发布后任何人都能通过 /share/:slug 访问这个 Agent 并对话。
 * 只有 owner 能发布自己的 Agent。
 *
 * Next.js 16: params 是 Promise，要 await
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
  const body = await request.json().catch(() => ({}));

  // 确认 Agent 存在且属于当前用户
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 如果已有 slug 且已公开，直接返回（幂等）
  if (agent.visibility === "PUBLIC" && agent.shareSlug) {
    return NextResponse.json({
      shareSlug: agent.shareSlug,
      shareUrl: `/share/${agent.shareSlug}`,
    });
  }

  // 生成 slug：用户传了自定义的就用自定义的，否则自动生成
  let slug = body.slug?.trim();
  if (!slug) {
    slug = await generateShareSlug(async (s) => {
      const existing = await prisma.agent.findUnique({
        where: { shareSlug: s },
        select: { id: true },
      });
      return !existing; // 没被占用就是唯一的
    });
  } else {
    // 校验自定义 slug：只允许字母数字和连字符，长度 3-32
    if (!/^[a-zA-Z0-9-]{3,32}$/.test(slug)) {
      return NextResponse.json(
        { error: "自定义链接只允许字母、数字和连字符，3-32 位" },
        { status: 400 }
      );
    }
    // 检查是否被其他 Agent 占用了
    const existing = await prisma.agent.findUnique({
      where: { shareSlug: slug },
      select: { id: true },
    });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "该链接已被占用" }, { status: 409 });
    }
  }

  // 发布：设置 slug + visibility
  await prisma.agent.update({
    where: { id },
    data: {
      shareSlug: slug,
      visibility: "PUBLIC",
    },
  });

  return NextResponse.json({
    shareSlug: slug,
    shareUrl: `/share/${slug}`,
  });
}
