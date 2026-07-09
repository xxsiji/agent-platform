import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth 回调路由。
 *
 * 邮箱+密码登录不需要这个路由。但当用户用第三方登录(GitHub/Google)时，
 * Supabase 会跳到第三方授权页，授权完再跳回这里：
 *
 *   用户 → GitHub 授权 → 跳回 /auth/callback?code=xxx → 本路由
 *
 * 本路由拿到 code，调 exchangeCodeForSession 换取登录 session，
 * 然后跳转到工作台。现在先放着，以后接 OAuth 时直接能用。
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // 交换失败，跳回登录页
      return NextResponse.redirect(
        new URL("/login?error=auth_callback_failed", requestUrl.origin)
      );
    }
  }

  // 成功，跳到目标页
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
