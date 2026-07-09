import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase 会话刷新 + 路由保护。
 *
 * 这个函数在代理(proxy.ts)里对每个请求执行，做两件事：
 *
 * 1. 刷新会话：Supabase 的 access token 会过期(默认 1 小时)。
 *    调用 getUser() 会触发 token 刷新——如果过期了，Supabase 自动用
 *    refresh token 换新 token，然后通过 setAll 写回 Cookie。
 *    这样用户登录态就不会因为 token 过期而丢失。
 *
 * 2. 路由保护：检查用户是否登录，未登录访问受保护页面就跳转到 /login。
 *
 * 为什么不在每个页面里单独检查？因为中间件在请求到达页面之前就执行了，
 * 能统一拦截，不用每个页面重复写鉴权代码。
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 先写到 request cookies(供后续服务端读取)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // 再创建新的 response 把 cookie 写回浏览器
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              path: "/",
              sameSite: "lax",
              // ⚠️ 本地 HTTP（非 HTTPS）环境【绝对不要】设 secure:true，否则 cookie 不写
              //   HTTPS（Vercel 部署后）浏览器会自动加 secure，无需手动
            })
          );
        },
      },
    }
  );

  // ⚠️ 必须调用 getUser()，它会触发 token 刷新逻辑
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 公开路由：登录页、OAuth 回调、公开分享页(免登录访问)、探索广场(免登录)、SEO 路由
  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/share") ||
    pathname.startsWith("/explore") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/opengraph-image");

  // API 路由：不在这里跳转(API 自己检查鉴权，返回 401)
  const isApiPath = pathname.startsWith("/api");

  // 规则 1：未登录 + 受保护页面 → 跳转到登录页
  if (!user && !isPublicPath && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname); // 记住原来要去哪
    return NextResponse.redirect(url);
  }

  // 规则 2：已登录 + 在登录页 → 跳转到工作台(避免重复登录)
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
