"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, LayoutDashboard, BarChart3, Sparkles, LogOut, Star, Compass } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

/**
 * 侧边栏导航(客户端组件)。
 *
 * 接收从服务端布局传来的用户信息(email)。
 * 底部显示用户邮箱 + 登出按钮。
 *
 * 登出流程：调 supabase.auth.signOut() 清除 Cookie → 跳转到 /login。
 */
const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/agents", label: "我的 Agent", icon: Bot },
  { href: "/favorites", label: "我的收藏", icon: Star },
  { href: "/usage", label: "用量看板", icon: BarChart3 },
  { href: "/explore", label: "探索广场", icon: Compass },
];

export function SidebarNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // 取邮箱 @ 前面的部分作为显示名
  const displayName = userEmail
    ? userEmail.split("@")[0]
    : "用户";

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      {/* 品牌 */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <span className="text-base font-semibold">Agent 平台</span>
      </div>

      {/* 导航 */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 底部用户区 */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">
              {displayName}
            </span>
            {userEmail && (
              <span className="truncate text-xs text-muted-foreground">
                {userEmail}
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            title="登出"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
