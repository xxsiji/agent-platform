import { cache } from "react";
import { Coins, MessageSquare, TrendingUp, Zap } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

/**
 * 用量看板页（服务端组件）。
 *
 * 直接查 UsageRecord 表：
 * - aggregate 算总 token；
 * - groupBy threadId 算独立对话数（排除 threadId 为 null 的记录）。
 *
 * 无用量记录时给出空状态引导；有数据时展示 4 个指标卡 + 图表占位。
 * 成本按 DeepSeek 约 ¥1 / 百万 token 做简单估算，文案已注明"预估"。
 */
export default async function UsagePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  // cache() 仅同一次请求内去重（不跨用户、不串号）。
  const getUsageStats = cache(async () => {
    const agg = await prisma.usageRecord.aggregate({
      where: { userId: currentUser.db.id },
      _sum: { totalTokens: true },
      _count: true,
    });

    const threads = await prisma.usageRecord.groupBy({
      by: ["threadId"],
      where: { userId: currentUser.db.id },
    });

    return { agg, threads };
  });
  const { agg, threads } = await getUsageStats();

  // groupBy 会把 threadId 为 null 的分到一组，统计独立对话数时排除它
  const conversationCount = threads.filter((t) => t.threadId).length;
  const totalTokens = agg._sum.totalTokens ?? 0;
  const estimatedCost = ((totalTokens / 1_000_000) * 1).toFixed(2);

  // 无用量记录 —— 空状态引导（不包在 Card 里，直接放主区域）
  if (agg._count === 0) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">用量看板</h1>
          <p className="text-sm text-muted-foreground">
            查看你的 Token 消耗与成本趋势。
          </p>
        </div>
        <EmptyState
          icon={<Coins className="size-6" />}
          title="还没有对话记录"
          description="开始和你的 Agent 对话，这里会统计 Token 消耗与成本。"
        />
      </div>
    );
  }

  const metrics = [
    {
      label: "本月 Token",
      value: totalTokens.toLocaleString(),
      icon: Zap,
      desc: "输入 + 输出合计",
    },
    {
      label: "对话数",
      value: String(conversationCount),
      icon: MessageSquare,
      desc: "独立会话总数",
    },
    {
      label: "预估成本",
      value: `¥${estimatedCost}`,
      icon: Coins,
      desc: "按 DeepSeek 约 ¥1/百万 token 估算",
    },
    {
      label: "环比增长",
      value: "—",
      icon: TrendingUp,
      desc: "暂无历史对比",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">用量看板</h1>
        <p className="text-sm text-muted-foreground">
          查看你的 Token 消耗与成本趋势。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="gap-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardDescription>{m.label}</CardDescription>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl tabular-nums">{m.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>消耗趋势</CardTitle>
          <CardDescription>近 30 天每日 Token 消耗</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            图表区域将在后续版本上线
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
