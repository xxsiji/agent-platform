import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col gap-4">
      {/* 页头占位 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-16" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
      {/* 消息区 */}
      <div className="flex flex-1 flex-col gap-4 rounded-xl border bg-background p-4">
        {[
          "left", "right", "left", "left", "right",
        ].map((side, i) => (
          <div key={i} className={`flex gap-3 ${side === "right" ? "flex-row-reverse" : "flex-row"}`}>
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className={`h-16 ${side === "right" ? "w-48" : "w-64"} rounded-2xl`} />
            </div>
          </div>
        ))}
      </div>
      {/* 输入条占位 */}
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
