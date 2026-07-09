import { redirect } from "next/navigation";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";
import { getCurrentUser } from "@/lib/auth";

/**
 * 工作台布局：左侧侧边栏 + 右侧主内容区。
 *
 * 这是路由组 (dashboard) 的布局，只作用于组内页面。
 *
 * 鉴权：在这里调用 getCurrentUser() 检查登录状态。
 * - 中间件已经做了第一层拦截(未登录跳 /login)
 * - 这里做第二层保护(双重保险)，同时拿到用户信息传给侧边栏
 *
 * 这是 Server Component，所以可以直接调 Prisma 查数据库、调 Supabase 读 session。
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  // 未登录 → 跳转登录页(正常情况下中间件已经拦了，这是兜底)
  if (!currentUser) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh w-full bg-muted/30">
      <SidebarNav userEmail={currentUser.auth.email ?? null} />
      <div className="flex min-h-0 flex-1 flex-col">
        {/* 手机端加 pb-20，给固定的底部 Tab 栏留出空间；桌面端恢复 p-8 */}
        <main className="flex-1 p-4 pb-20 md:p-8">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
