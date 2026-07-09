import { AgentCardSkeleton } from "@/components/agent-card-skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-8 h-9 w-48 rounded-md bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
