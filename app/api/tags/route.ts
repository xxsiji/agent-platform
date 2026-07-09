import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * 标签列表 API（免登录）
 *
 * GET /api/tags
 *
 * 返回使用次数最多的前 10 个标签，供探索页标签筛选条用。
 * 使用次数 = 该标签关联的 Agent 数量（通过 _count.agents）。
 */
export async function GET() {
  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { agents: true } },
    },
    // 按关联 Agent 数量降序，取前 10
    orderBy: { agents: { _count: "desc" } },
    take: 10,
  });

  return NextResponse.json(
    tags.map((t) => ({
      id: t.id,
      name: t.name,
      count: t._count.agents,
    }))
  );
}
