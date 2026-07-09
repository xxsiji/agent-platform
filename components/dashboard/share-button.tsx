"use client";

import { useState } from "react";
import { Globe, Copy, Check, Loader2, Lock, ExternalLink, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";

/**
 * 分享按钮组件。
 *
 * 根据 Agent 的公开状态显示不同操作：
 * - PRIVATE: 显示"发布"按钮 → 调 publish API → 变成公开
 * - PUBLIC:  显示分享链接 + 复制按钮 + 撤回按钮
 *
 * 这是客户端组件，因为要：
 * - 调用 publish/unpublish API
 * - 复制链接到剪贴板
 * - 响应按钮点击和加载状态
 */
interface ShareButtonProps {
  agentId: string;
  initialIsPublic: boolean;
  initialShareSlug: string | null;
}

export function ShareButton({
  agentId,
  initialIsPublic,
  initialShareSlug,
}: ShareButtonProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [shareSlug, setShareSlug] = useState(initialShareSlug);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // 发布
  async function handlePublish() {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "发布失败");
        return;
      }
      const data = await res.json();
      setShareSlug(data.shareSlug);
      setIsPublic(true);
    } catch {
      alert("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  // 撤回
  async function handleUnpublish() {
    if (!confirm("撤回后分享链接将失效，确定吗？")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/unpublish`, {
        method: "POST",
      });
      if (!res.ok) {
        alert("撤回失败");
        return;
      }
      setIsPublic(false);
      setShareSlug(null);
    } catch {
      alert("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  // 复制链接
  async function handleCopy() {
    if (!shareSlug) return;
    const url = `${window.location.origin}/share/${shareSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 某些浏览器不支持 clipboard API，降级到选中文本
      window.prompt("复制分享链接：", url);
    }
  }

  if (!isPublic) {
    // 未公开：显示发布按钮
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handlePublish}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Globe className="size-3.5" />
        )}
        发布
      </Button>
    );
  }

  // 已公开：显示链接 + 复制 + 撤回
  return (
    <div className="flex items-center gap-1.5">
      {/* 公开标识 */}
      <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
        <Globe className="size-3" />
        已公开
      </span>

      {/* 复制链接 */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopy}
        disabled={loading}
        className="gap-1.5"
        title="复制分享链接"
      >
        {copied ? (
          <Check className="size-3.5 text-green-600" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {copied ? "已复制" : "链接"}
      </Button>

      {/* 在新窗口打开公开页 */}
      {shareSlug && (
        <Button asChild size="sm" variant="ghost" className="gap-1.5 px-2">
          <a
            href={`/share/${shareSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="在新窗口打开公开页"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      )}

      {/* 二维码 */}
      {shareSlug && (
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowQR((s) => !s)}
            className="gap-1.5 px-2"
            title="显示二维码"
          >
            <QrCode className="size-3.5" />
          </Button>
          {showQR && (
            <div className="absolute right-0 top-full z-50 mt-2 rounded-lg border bg-popover p-3 shadow-lg">
              <div className="rounded-lg border bg-white p-2">
                <QRCodeSVG
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareSlug}`}
                  size={160}
                  level="M"
                />
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">扫码访问分享页</p>
            </div>
          )}
        </div>
      )}

      {/* 撤回 */}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleUnpublish}
        disabled={loading}
        className="gap-1.5 px-2 text-muted-foreground hover:text-destructive"
        title="撤回公开"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Lock className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
