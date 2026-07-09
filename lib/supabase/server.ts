import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 服务端 Supabase 客户端。
 *
 * 用在 Server Component 和 Route Handler 里，比如读取当前登录用户、
 * 服务端鉴权。
 *
 * Next.js 16 关键变化：cookies() 返回 Promise，必须 await！
 * (Next.js 15 之前是同步的)
 *
 * createServerClient 需要我们告诉它怎么读写 Cookie：
 * - getAll：把请求里的所有 Cookie 读出来给 Supabase
 * - setAll：Supabase 刷新 session 后写回新 Cookie
 *   (setAll 在 Server Component 里可能抛错——因为 Server Component 是只读的，
 *    这种情况忽略即可，中间件会负责刷新)
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在 Server Component 中调用时无法 set Cookie(只读)，
            // 这是正常的——中间件会处理 session 刷新。
          }
        },
      },
    }
  );
}
