"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * 探索页头部登录态导航（客户端组件）。
 *
 * 性能优化解耦：探索页 Server Component 不再调用 getCurrentUser()
 * （那会读取 cookie 导致整页变为 dynamic，使 unstable_cache 的 revalidate 失效）。
 * 登录态 UI 下放到这个客户端组件，用轻量的 cookie 存在性判断：
 * 存在 Supabase 的 auth-token cookie → 视为已登录，显示「工作台」入口；
 * 否则显示「登录 / 注册」按钮。
 *
 * 首屏 SSR 渲染为未登录态，与首次客户端渲染完全一致（无 hydration mismatch），
 * 挂载后再根据 cookie 校正。这样整页保持 static，缓存才能生效。
 */
export function ExploreAuthNav() {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    // 轻量判断：cookie 中存在 Supabase 的 auth-token（前缀 sb-，后缀 -auth-token）
    const hasAuthCookie = document.cookie
      .split("; ")
      .some((c) => /^sb-.*-auth-token=/.test(c));
    setIsAuthed(hasAuthCookie);
  }, []);

  if (isAuthed) {
    return (
      <Button asChild size="sm">
        <Link href="/">工作台</Link>
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">登录</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/login">注册</Link>
      </Button>
    </div>
  );
}
