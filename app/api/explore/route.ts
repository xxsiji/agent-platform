import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * 探索广场 API（免登录）
 *
 * GET /api/explore?q=关键词&sort=popular|latest&tag=标签名&page=1
 *
 * 只查 visibility=PUBLIC + status=ACTIVE + deletedAt=null 的 Agent。
 * - popular 排序：likeCount DESC, conversationsCount DESC（近似加权：点赞权重更高）
 * - latest 排序：createdAt DESC
 * - 搜索：Postgres ILIKE 模糊匹配 name + description（Prisma 的 mode: "insensitive"）
 * - tag 筛选：通过 AgentTag 关联表 JOIN
 *
 * 返回：{ agents, total, page, pageSize, hasMore }
 */
const PAGE_SIZE = 12;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 解析参数，带默认值和安全处理
  const q = searchParams.get("q")?.trim() || "";
  const sort = searchParams.get("sort") === "latest" ? "latest" : "popular";
  const tag = searchParams.get("tag")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  // 构建查询条件
  const where = {
    visibility: "PUBLIC" as const,
    status: "ACTIVE" as const,
    deletedAt: null,
    // 搜索：ILIKE 模糊匹配名称和描述
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
      ],
    }),
    // 标签筛选：通过关联表查
    ...(tag && {
      tags: { some: { tag: { name: tag } } },
    }),
  };

  // 并行查数据 + 总数
  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      orderBy:
        sort === "latest"
          ? { createdAt: "desc" }
          : // popular：点赞多的排前面，点赞相同看对话数
            [{ likeCount: "desc" }, { conversationsCount: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        description: true,
        avatarUrl: true,
        shareSlug: true,
        likeCount: true,
        shareCount: true,
        _count: { select: { comments: true } },
        createdAt: true,
        owner: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    }),
    prisma.agent.count({ where }),
  ]);

  // 扁平化数据：把嵌套的 owner/tags 拍平，方便前端使用
  const result = agents.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    avatarUrl: a.avatarUrl,
    shareSlug: a.shareSlug,
    likeCount: a.likeCount,
    commentCount: a._count.comments,
    shareCount: a.shareCount,
    createdAt: a.createdAt,
    ownerName: a.owner?.name ?? "匿名",
    tags: a.tags.map((t) => t.tag.name),
  }));

  return NextResponse.json({
    agents: result,
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: page * PAGE_SIZE < total,
  });
}
