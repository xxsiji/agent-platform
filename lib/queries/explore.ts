import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

/**
 * 探索广场首屏数据（Server 端查询，无用户依赖）。
 *
 * 用 unstable_cache 包一层，让整页保持 static + 每 60s 重校验，
 * 而不是每次请求都打 DB。关键约束：这个函数内部【严禁】读取
 * cookies()/headers()/getCurrentUser() —— 否则整页会被迫变 dynamic，
 * revalidate 失效。登录态 UI 已由 components/explore/explore-auth-nav 客户端组件承担。
 *
 * 查询条件与改造前完全一致：只看 PUBLIC + ACTIVE + 未删除的 Agent。
 */

/** AgentCard 需要的数据（与 components/agent-card 的 AgentCardData 同构） */
export type ExploreAgent = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  /** shareSlug 在库中为可空字段，用 string | null（兼容 AgentCardData） */
  shareSlug: string | null;
  likeCount: number;
  /** 评论数（取 Agent.comments 关联计数，而非对话数） */
  commentCount: number;
  tags: string[];
};

/** 标签筛选条数据 */
export type ExploreTag = {
  id: string;
  name: string;
  count: number;
};

export type ExploreData = {
  agents: ExploreAgent[];
  total: number;
  tags: ExploreTag[];
};

export const getExploreData = unstable_cache(
  async (): Promise<ExploreData> => {
    // 只看公开 + 活跃 + 未删除的 Agent
    const where = {
      visibility: "PUBLIC" as const,
      status: "ACTIVE" as const,
      deletedAt: null,
    };

    // 并行查：第一页热门 Agent + 总数 + 热门标签
    const [agents, total, tags] = await Promise.all([
      prisma.agent.findMany({
        where,
        orderBy: [{ likeCount: "desc" }, { conversationsCount: "desc" }],
        take: 12,
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
      prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { agents: true } },
        },
        orderBy: { agents: { _count: "desc" } },
        take: 10,
      }),
    ]);

    // 映射成 AgentCard 需要的数据格式（拍平 owner/tags）
    const mappedAgents: ExploreAgent[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      avatarUrl: a.avatarUrl,
      shareSlug: a.shareSlug,
      likeCount: a.likeCount,
      commentCount: a._count.comments,
      tags: a.tags.map((t) => t.tag.name),
    }));

    const mappedTags: ExploreTag[] = tags.map((t) => ({
      id: t.id,
      name: t.name,
      count: t._count.agents,
    }));

    return {
      agents: mappedAgents,
      total,
      tags: mappedTags,
    };
  },
  // 固定 cache key，保证同一份数据只查一次
  ["explore-hot"],
  { revalidate: 60, tags: ["explore"] }
);
