import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Bot, MessageSquare } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCachedPublicAgent } from "@/lib/queries/agent";
import { getCurrentUser } from "@/lib/auth";
import { PublicChat } from "@/components/share/chat";
import { InteractionBar } from "@/components/share/interaction-bar";
import { CommentSection } from "@/components/share/comment-section";

/**
 * 公开访问页(免登录 SSR)。
 *
 * 路由：/share/:slug
 *
 * 这是 Server Component——直接用 Prisma 查数据库，SSR 渲染。
 * 任何人打开这个链接都能直接对话，不需要注册登录。
 *
 * 脱敏：只返回 name/description/avatarUrl，
 * 绝不返回 systemPrompt（那是 Agent 的核心配置，不能泄露）。
 *
 * SEO：用 generateMetadata 动态生成标题和描述，
 * 这样分享到微信/Twitter 时能显示正确的卡片信息。
 *
 * Next.js 16: params 是 Promise，要 await！
 */

// 生成页面元数据(用于 SEO 和分享卡片)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const agent = await getCachedPublicAgent(slug);

  // 不存在或未公开 → 默认标题（保留原分支）
  if (!agent || agent.visibility !== "PUBLIC" || agent.deletedAt) {
    return { title: "Agent 不存在" };
  }

  const description = agent.description || `与 ${agent.name} 对话`;

  return {
    title: agent.name,
    description,
    alternates: {
      canonical: `/share/${slug}`,
    },
    openGraph: {
      title: agent.name,
      description,
      type: "website",
      url: `/share/${slug}`,
      siteName: "Agent 智能体平台",
      locale: "zh_CN",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 查 Agent：只查公开的、未删除的，加上互动计数字段
  // 与 generateMetadata 共用缓存，同一 agent 的 DB 查询从 2 次降到 1 次
  const agent = await getCachedPublicAgent(slug);

  // 不存在 / 未公开 / 已删除 → 404
  if (!agent || agent.visibility !== "PUBLIC" || agent.deletedAt || !agent.shareSlug) {
    notFound();
  }

  // 检查当前用户是否登录，以及是否已点赞/已收藏
  // 公开页不需要登录就能看，但互动按钮需要登录
  const currentUser = await getCurrentUser();
  let isLiked = false;
  let isFavorited = false;
  let likedCommentIds: string[] = [];

  if (currentUser) {
    // 并行查：Agent 点赞/收藏状态 + 评论点赞记录
    const [likeRecord, favoriteRecord, commentLikes] = await Promise.all([
      prisma.agentLike.findUnique({
        where: {
          userId_agentId: {
            userId: currentUser.db.id,
            agentId: agent.id,
          },
        },
      }),
      prisma.agentFavorite.findUnique({
        where: {
          userId_agentId: {
            userId: currentUser.db.id,
            agentId: agent.id,
          },
        },
      }),
      // 查当前用户在该 Agent 下所有评论的点赞记录
      prisma.commentLike.findMany({
        where: {
          userId: currentUser.db.id,
          comment: { agentId: agent.id },
        },
        select: { commentId: true },
      }),
    ]);
    isLiked = !!likeRecord;
    isFavorited = !!favoriteRecord;
    likedCommentIds = commentLikes.map((cl) => cl.commentId);
  }

  return (
    <div className="flex h-dvh flex-col bg-muted/30">
      {/* 顶部 Agent 信息栏 */}
      <header className="border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {/* 头像 */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          {/* 名称 + 描述 */}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{agent.name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {agent.description || "AI 智能体"}
            </p>
          </div>
          {/* 评论数（取 Agent.comments 关联计数，而非对话数） */}
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="size-3" />
            {agent._count.comments}
          </div>
        </div>
      </header>

      {/* 聊天区域 */}
      <main className="flex-1 overflow-hidden">
        <PublicChat slug={agent.shareSlug} agentName={agent.name} />
      </main>

      {/* 评论区 */}
      <div className="max-h-[35vh] overflow-y-auto border-t bg-background">
        <CommentSection
          agentId={agent.id}
          isAuthenticated={!!currentUser}
          likedCommentIds={likedCommentIds}
          currentUserId={currentUser?.db.id ?? null}
        />
      </div>

      {/* 互动栏：点赞 / 收藏 / 转发 */}
      <InteractionBar
        agentId={agent.id}
        slug={agent.shareSlug}
        initialLiked={isLiked}
        initialFavorited={isFavorited}
        initialLikeCount={agent.likeCount}
        initialFavoriteCount={agent.favoriteCount}
        initialShareCount={agent.shareCount}
        isAuthenticated={!!currentUser}
      />
    </div>
  );
}
