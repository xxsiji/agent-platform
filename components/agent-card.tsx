import Link from "next/link";
import { Bot, Heart, MessageSquare } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * 可复用的 Agent 卡片组件。
 *
 * 探索页和"我的收藏"页都用这个组件展示 Agent 信息。
 * 点击卡片跳转到公开详情页 /share/[slug]。
 *
 * 悬停效果：轻微放大 + 阴影，让用户感知可点击。
 */

// 卡片需要的数据类型——两处调用方都映射成这个结构
export type AgentCardData = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  shareSlug: string | null;
  likeCount: number;
  /** 评论数（取 Agent.comments 关联计数，而非对话数） */
  commentCount: number;
  tags: string[];
};

export function AgentCard({ agent }: { agent: AgentCardData }) {
  return (
    <Link href={`/share/${agent.shareSlug}`} className="block h-full">
      <Card className="group flex h-full flex-col gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
        <CardContent className="flex flex-1 flex-col gap-3 pt-6">
          {/* 头像 + 名称 */}
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {agent.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agent.avatarUrl}
                  alt={agent.name}
                  className="size-10 rounded-lg object-cover"
                />
              ) : (
                <Bot className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium">{agent.name}</h3>
            </div>
          </div>

          {/* 描述（最多 2 行，超出截断） */}
          <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
            {agent.description || "暂无描述"}
          </p>

          {/* 标签（最多显示 3 个） */}
          {agent.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 统计数据 */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="size-3" />
              {agent.likeCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" />
              {agent.commentCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
