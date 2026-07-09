import { createBrowserClient } from "@supabase/ssr";

/**
 * 浏览器端 Supabase 客户端。
 *
 * 用在客户端组件("use client")里，比如登录页调 signInWithPassword、
 * 侧边栏调 signOut。
 *
 * createBrowserClient 是 @supabase/ssr 提供的，它会自动读写浏览器 Cookie，
 * 这样登录后 session 就存在 Cookie 里，服务端也能读到(实现 SSR 鉴权)。
 *
 * NEXT_PUBLIC_ 前缀的变量会打包进浏览器代码，所以只能放 anon key(受 RLS 保护的安全密钥)。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
