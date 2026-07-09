"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Star, Share2, Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";

/**
 * 公开页互动栏（客户端组件）。
 *
 * 三个按钮：点赞 / 收藏 / 转发
 *
 * 权限逻辑：
 * - 未登录 → 点任何按钮都跳转 /login
 * - 已登录 → 点赞/收藏 调 API toggle，转发 弹面板复制链接 + 计数+1
 *
 * 父组件(share page)在 SSR 时已经查好了初始状态(是否已赞/已收藏/计数)，
 * 传进来作为初始值，避免客户端闪烁。
 */

interface InteractionBarProps {
  agentId: string;
  slug: string;
  initialLiked: boolean;
  initialFavorited: boolean;
  initialLikeCount: number;
  initialFavoriteCount: number;
  initialShareCount: number;
  isAuthenticated: boolean;
}

export function InteractionBar({
  agentId,
  slug,
  initialLiked,
  initialFavorited,
  initialLikeCount,
  initialFavoriteCount,
  initialShareCount,
  isAuthenticated,
}: InteractionBarProps) {
  const router = useRouter();
  const { toast } = useToast();

  // 本地状态：跟 API 同步
  const [liked, setLiked] = useState(initialLiked);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount);
  const [shareCount, setShareCount] = useState(initialShareCount);

  // 转发面板的显示/隐藏
  const [showSharePanel, setShowSharePanel] = useState(false);
  // 复制成功提示
  const [copied, setCopied] = useState(false);

  // 点赞
  async function handleLike() {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // 乐观更新：先改 UI，再发请求
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => c + (newLiked ? 1 : -1));

    try {
      const res = await fetch(`/api/agents/${agentId}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // 用服务端返回的真实值校正
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      // 失败了回滚
      setLiked(!newLiked);
      setLikeCount((c) => c + (newLiked ? -1 : 1));
      toast("操作失败，请重试");
    }
  }

  // 收藏
  async function handleFavorite() {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const newFavorited = !favorited;
    setFavorited(newFavorited);
    setFavoriteCount((c) => c + (newFavorited ? 1 : -1));

    try {
      const res = await fetch(`/api/agents/${agentId}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFavorited(data.favorited);
      setFavoriteCount(data.favoriteCount);
    } catch {
      setFavorited(!newFavorited);
      setFavoriteCount((c) => c + (newFavorited ? -1 : 1));
      toast("操作失败，请重试");
    }
  }

  // 转发
  async function handleShare() {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // 弹出分享面板
    setShowSharePanel((s) => !s);

    // 如果是第一次点（面板刚打开），计 shareCount+1
    if (!showSharePanel) {
      try {
        const res = await fetch(`/api/agents/${agentId}/share`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setShareCount(data.shareCount);
        }
      } catch {
        // 静默失败，不影响用户体验
      }
    }
  }

  // 复制链接
  async function copyLink() {
    const url = `${window.location.origin}/share/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 某些浏览器不支持 clipboard API，降级用 prompt
      window.prompt("复制以下链接：", url);
    }
  }

  return (
    <div className="relative border-t bg-background px-4 py-2 pb-safe">
      <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 sm:gap-6">
        {/* 点赞 */}
        <button
          onClick={handleLike}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted sm:px-3"
        >
          <Heart
            className={cn(
              "size-4 transition-colors",
              liked ? "fill-red-500 text-red-500" : "text-muted-foreground"
            )}
          />
          <span className={cn(liked ? "text-red-500" : "text-muted-foreground")}>
            {likeCount}
          </span>
        </button>

        {/* 收藏 */}
        <button
          onClick={handleFavorite}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted sm:px-3"
        >
          <Star
            className={cn(
              "size-4 transition-colors",
              favorited ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            )}
          />
          <span className={cn(favorited ? "text-yellow-600" : "text-muted-foreground")}>
            {favoriteCount}
          </span>
        </button>

        {/* 转发 */}
        <button
          onClick={handleShare}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted sm:px-3"
        >
          <Share2 className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{shareCount}</span>
        </button>
      </div>

      {/* 分享面板 */}
      {showSharePanel && (
        <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border bg-popover p-4 shadow-lg">
          <p className="mb-2 text-xs font-medium text-muted-foreground">分享链接</p>
          {/* 二维码 */}
          <div className="mb-3 flex justify-center">
            <div className="rounded-lg border bg-white p-2">
              <QRCodeSVG
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${slug}`}
                size={128}
                level="M"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="max-w-[240px] truncate rounded bg-muted px-2 py-1 text-xs">
              {typeof window !== "undefined" ? `${window.location.origin}/share/${slug}` : ""}
            </code>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {copied ? (
                <>
                  <Check className="size-3" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  复制
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">扫码或复制链接分享</p>
        </div>
      )}
    </div>
  );
}
