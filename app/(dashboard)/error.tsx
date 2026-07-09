"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

/**
 * 工作台（(dashboard) 路由组）错误边界。
 * 捕获工作台下任意页面渲染错误，提供"重试"与"返回工作台"两个出口。
 */
export default function DashboardError({
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
        <LayoutDashboard className="size-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">工作台出错了</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          工作台加载出现问题，请稍后重试。
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            reset();
            router.refresh();
          }}
        >
          重试
        </Button>
        <Button onClick={() => router.push("/agents")}>返回工作台</Button>
      </div>
    </div>
  );
}
