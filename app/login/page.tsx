"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Mail, Lock, Loader2, Compass } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * 登录/注册页。
 *
 * 这是客户端组件("use client")，因为要：
 * - 用 useState 管理表单输入和加载状态
 * - 调用 Supabase 浏览器客户端的登录方法
 * - 登录成功后用整页跳转(window.location.assign) 让 session cookie 先落盘，避免与 middleware 的竞态
 *
 * 邮箱+密码认证的流程：
 * 1. 用户填邮箱密码，点"登录"
 * 2. 调 supabase.auth.signInWithPassword({ email, password })
 * 3. Supabase 校验密码，通过后把 session 写入 Cookie
 * 4. 前端收到成功响应，跳转到工作台
 *
 * 注册流程类似，调 signUp。Supabase 可能开启邮箱确认——
 * 开启时 signUp 不会立即登录，而是发确认邮件。
 */
function LoginForm() {
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      setError("请输入有效的邮箱地址");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message === "Invalid login credentials"
          ? "邮箱或密码错误"
          : error.message);
        setLoading(false);
        return;
      }
      // 登录成功，跳转到原来要去的页面或工作台首页
      // 用整页跳转替代 SPA 跳转：先让浏览器把 session cookie flush 落盘，
      // 再带新 cookie 重新请求目标页，确保 middleware(server 端) 能读到 session
      const redirect = searchParams.get("redirect") || "/";
      window.location.assign(redirect);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // 如果 Supabase 开启了邮箱确认，data.session 会是 null
      if (!data.session) {
        setNotice("注册成功！请检查邮箱完成验证，然后回来登录。");
        setMode("login");
        setLoading(false);
      } else {
        // 没开邮箱确认，直接登录了
        // 用整页跳转替代 SPA 跳转，保持与 login 成功分支一致
        window.location.assign("/");
      }
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        {/* 品牌标识 */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-6" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">Agent 智能体平台</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              创建你的专属 AI Agent
            </p>
          </div>
        </div>

        {/* 表单卡片 */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {/* 模式切换 */}
          <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 邮箱 */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                {notice}
              </p>
            )}

            {/* 提交按钮 */}
            <Button type="submit" disabled={loading} className="mt-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "登录" : "注册"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          登录即表示你同意我们的服务条款
        </p>

        {/* 探索广场入口（免登录） */}
        <div className="mt-4 text-center">
          <a
            href="/explore"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Compass className="size-3" />
            或者先去探索广场逛逛 →
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * 登录页根组件。
 * useSearchParams() 必须包在 <Suspense> 里，否则 next build 预渲染 /login 会报错
 * （"useSearchParams() should be wrapped in a suspense boundary"）。
 * 这里把真正用到 searchParams 的表单逻辑抽到 <LoginForm/>，本组件只负责兜底 Suspense。
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
          加载中...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
