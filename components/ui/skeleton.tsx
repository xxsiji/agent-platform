import { cn } from "@/lib/utils";

/**
 * shadcn/ui 标准 Skeleton 组件。
 * 用 animate-pulse 的占位块模拟即将加载的内容，避免白屏。
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
