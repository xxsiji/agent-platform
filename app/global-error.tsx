"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * 根布局崩溃的终极兜底。
 * 必须自带 <html>/<body>，因为它在根布局之外渲染。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">出错了</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            应用遇到未知错误，请刷新页面重试。
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          重试
        </button>
      </body>
    </html>
  );
}
