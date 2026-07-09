"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * 根级错误边界。
 * 捕获根布局下任意路由段的渲染错误，显示友好提示而非白屏/英文堆栈。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">页面出错了</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          页面加载出现问题，请稍后重试。
        </p>
      </div>
      <Button
        onClick={() => {
          reset();
          router.refresh();
        }}
      >
        重试
      </Button>
    </div>
  );
}
