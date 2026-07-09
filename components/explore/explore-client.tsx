"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, Compass, TrendingUp, Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AgentCard, type AgentCardData } from "@/components/agent-card";
import { EmptyState } from "@/components/empty-state";
import { AgentCardSkeleton } from "@/components/agent-card-skeleton";
import Link from "next/link";

/**
 * 探索广场客户端组件。
 *
 * 设计思路：
 * 1. 服务端 SSR 首屏数据（第一页热门 Agent + 标签列表）通过 props 传入，
 *    用户打开页面立即可见，对 SEO 也有利。
 * 2. 用户交互（搜索/排序/筛选）时，客户端调 /api/explore 重新获取。
 * 3. "加载更多"按钮追加下一页，不重新加载已有数据。
 *
 * 搜索防抖：用户输入时等 300ms 没有新输入才触发搜索，避免每按一个字母就请求。
 */
type TagItem = { id: string; name: string; count: number };
type SortMode = "popular" | "latest";

export function ExploreClient({
  initialAgents,
  initialTotal,
  initialTags,
}: {
  initialAgents: AgentCardData[];
  initialTotal: number;
  initialTags: TagItem[];
}) {
  // 列表数据
  const [agents, setAgents] = useState(initialAgents);
  const [total, setTotal] = useState(initialTotal);
  const tags = initialTags;

  // 筛选状态
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("popular");
  const [selectedTag, setSelectedTag] = useState("");

  // 分页 & 加载状态
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 首次渲染标记——避免 mount 时重复请求首屏数据（SSR 已经给了）
  const isFirstRender = useRef(true);

  // 搜索防抖：输入变化后 300ms 才更新 debouncedSearch
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 筛选条件变化 → 重新查第一页
  useEffect(() => {
    // 首次渲染跳过（SSR 已有数据）
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    let cancelled = false;

    async function fetchFirstPage() {
      setLoading(true);

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      params.set("sort", sort);
      if (selectedTag) params.set("tag", selectedTag);
      params.set("page", "1");

      const res = await fetch(`/api/explore?${params}`);
      const data = await res.json();

      if (!cancelled) {
        setAgents(data.agents);
        setTotal(data.total);
        setPage(1);
        setLoading(false);
      }
    }

    fetchFirstPage();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, sort, selectedTag]);

  // 加载更多：追加下一页数据
  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("sort", sort);
    if (selectedTag) params.set("tag", selectedTag);
    params.set("page", String(nextPage));

    try {
      const res = await fetch(`/api/explore?${params}`);
      const data = await res.json();
      setAgents((prev) => [...prev, ...data.agents]);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [page, debouncedSearch, sort, selectedTag]);

  const hasMore = agents.length < total;

  return (
    <div className="flex flex-col gap-6">
      {/* 搜索框 + 排序 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 Agent 名称或描述..."
            className="w-full pl-10"
          />
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant={sort === "popular" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("popular")}
            className="flex-1 sm:flex-initial"
          >
            <TrendingUp className="size-4" />
            热门
          </Button>
          <Button
            variant={sort === "latest" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("latest")}
            className="flex-1 sm:flex-initial"
          >
            <Clock className="size-4" />
            最新
          </Button>
        </div>
      </div>

      {/* 标签筛选条 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !selectedTag
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            全部
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setSelectedTag(tag.name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedTag === tag.name
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tag.name}
              <span className="ml-1 opacity-60">{tag.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* 结果区域 */}
      {loading ? (
        /* 搜索/筛选进行中：骨架网格 */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      ) : agents.length === 0 ? (
        /* 空状态：区分「全站无公开 Agent」与「搜索/筛选无果」 */
        !debouncedSearch && !selectedTag ? (
          <EmptyState
            icon={<Compass className="size-6" />}
            title="还没有公开的 Agent，去创建一个吧"
            description="成为第一个分享 Agent 的人，让更多人发现你的创作。"
            action={
              <Button asChild size="sm">
                <Link href="/agents/new">创建 Agent</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Compass className="size-6" />}
            title="没有找到相关 Agent"
            description="换个关键词或标签试试"
          />
        )
      ) : (
        <>
          {/* 结果总数 */}
          <p className="text-xs text-muted-foreground">
            共 {total} 个 Agent
          </p>

          {/* 卡片网格 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>

          {/* 加载更多 */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
                加载更多
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
