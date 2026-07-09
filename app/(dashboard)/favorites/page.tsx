import { cache } from "react";
import Link from "next/link";
import { Bot, Star, Compass } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/agent-card";
import { EmptyState } from "@/components/empty-state";

/**
 * 我的收藏页面。
 *
 * 路由：/favorites（在 dashboard 路由组里，需要登录）
 *
 * 列出当前用户收藏的公开 Agent。
 * 如果 Agent 被主人删除或改为私有，就不显示了（where 条件过滤）。
 *
 * 这是 Server Component——直接用 Prisma 查 AgentFavorite 表，
 * include 关联的 Agent 信息（含标签）。
 */
export default async function FavoritesPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  // 查当前用户的所有收藏，关联 Agent 详情
  // where 里过滤：只显示仍然公开且未删除的 Agent
  // cache() 仅同一次请求内去重（不跨用户、不串号）。
  const getFavorites = cache(async () => {
    return prisma.agentFavorite.findMany({
      where: {
        userId: currentUser.db.id,
        agent: {
          visibility: "PUBLIC",
          deletedAt: null,
        },
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true,
            shareSlug: true,
            likeCount: true,
            favoriteCount: true,
            _count: { select: { comments: true } },
            tags: { select: { tag: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });
  const favorites = await getFavorites();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* 页头 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">我的收藏</h1>
          <p className="text-sm text-muted-foreground">
            你收藏的公开 Agent，点击可前往对话。
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/explore">
            <Compass className="size-4" />
            探索广场
          </Link>
        </Button>
      </div>

      {favorites.length === 0 ? (
        /* 空状态 */
        <EmptyState
          icon={<Star className="size-6" />}
          title="还没有收藏任何 Agent"
          description="去探索广场逛逛，发现有趣的 AI 智能体吧。"
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/explore">
                去探索
                <Compass className="size-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        /* 收藏卡片网格——复用 AgentCard 组件 */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <AgentCard
              key={fav.agentId}
              agent={{
                id: fav.agent.id,
                name: fav.agent.name,
                description: fav.agent.description,
                avatarUrl: fav.agent.avatarUrl,
                shareSlug: fav.agent.shareSlug,
                likeCount: fav.agent.likeCount,
                commentCount: fav.agent._count.comments,
                tags: fav.agent.tags.map((t) => t.tag.name),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
