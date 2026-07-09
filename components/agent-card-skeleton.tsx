import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * AgentCard 的骨架屏。
 *
 * 结构与真实 AgentCard（components/agent-card.tsx）一一对应：
 * 头像 + 名称 → 描述两行 → 标签 chips → 底部统计数据，
 * 整体高度接近真实卡片，loading 时不会跳动。
 */
export function AgentCardSkeleton() {
  return (
    <Card className="flex h-full flex-col gap-3">
      <CardContent className="flex flex-1 flex-col gap-3 pt-6">
        {/* 头像方块 + 右侧两行标题 */}
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>

        {/* 描述 2 行 */}
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>

        {/* 标签 2~3 个 chip */}
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-10 rounded-md" />
        </div>

        {/* 底部统计行 2 个 */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
        </div>
      </CardContent>
    </Card>
  );
}
