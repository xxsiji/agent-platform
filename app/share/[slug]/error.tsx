"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Link2Off } from "lucide-react";

/**
 * 分享页错误边界。
 * 捕获单个分享页渲染错误，提供"重试"与"返回首页"出口。
 */
export default function ShareError({
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
        <Link2Off className="size-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">该分享页暂时无法访问</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          请稍后重试，或返回首页。
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
        <Button onClick={() => router.push("/")}>返回首页</Button>
      </div>
    </div>
  );
}
