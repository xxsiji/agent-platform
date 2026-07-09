import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 代理入口。
 *
 * proxy.ts 必须放在项目根目录，Next.js 会自动识别。
 * 它在每个请求到达页面/API 之前执行，类似 Express 的 app.use()。
 *
 * 这里我们只做一件事：调用 Supabase 的 updateSession 刷新登录态 + 路由保护。
 *
 * matcher 配置：排除静态资源(_next/static、图片等)，避免对静态文件也跑代理造成浪费。
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，但排除：
     * - _next/static (Next.js 静态资源)
     * - _next/image (图片优化)
     * - favicon.ico
     * - 各种图片文件
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
