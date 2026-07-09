"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LayoutDashboard, BarChart3, Star, Compass } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 手机端底部 Tab 栏（仅 <md 显示）。
 *
 * 桌面端由 SidebarNav（左侧侧边栏）提供导航，本组件是其移动端替代：
 * - fixed bottom-0 固定在视口底部，z-50 置顶
 * - md:hidden 桌面端隐藏（与左侧侧边栏互斥）
 * - 5 个入口横向均分 grid-cols-5，当前路由高亮
 * - h-14 保证触摸目标 ≥44px，底部用 safe-area 适配刘海屏
 */
const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/favorites", label: "收藏", icon: Star },
  { href: "/usage", label: "用量", icon: BarChart3 },
  { href: "/explore", label: "探索", icon: Compass },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
      {navItems.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
