import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

/**
 * 取公开 Agent（分享页 /share/[slug] 用）。
 *
 * 分享页的 generateMetadata 与主渲染函数原本各查一次 findUnique（同一 agent 查 2 次）。
 * 这里用 unstable_cache 包一层、key 含 slug：同一次请求里两处各调一次，
 * 第二次命中缓存，DB 查询从 2 次降到 1 次；跨请求则按 30s 重校验。
 *
 * select 字段覆盖原两处用到的全部字段：
 * - generateMetadata 需要：name, description, visibility, deletedAt
 * - 主函数需要：id, name, description, avatarUrl, visibility, deletedAt,
 *   shareSlug, likeCount, favoriteCount, shareCount, _count.comments(评论数)
 * 未公开 / 已删除分支（返回不存在）逻辑保留在调用方。
 *
 * 关键约束：本函数内部【严禁】读取 cookies()/headers()/getCurrentUser()。
 */
export const getCachedPublicAgent = (slug: string) =>
  unstable_cache(
    async () =>
      prisma.agent.findUnique({
        where: { shareSlug: slug },
        select: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
          visibility: true,
          deletedAt: true,
          shareSlug: true,
          likeCount: true,
          favoriteCount: true,
          shareCount: true,
          _count: { select: { comments: true } },
        },
      }),
    ["public-agent", slug],
    { revalidate: 30, tags: ["agent", `agent-${slug}`] }
  )();

/** 取缓存 Agent 的载荷类型（去掉 null 后的形状），供调用方复用 */
export type CachedPublicAgent = NonNullable<
  Awaited<ReturnType<typeof getCachedPublicAgent>>
>;
