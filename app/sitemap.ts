import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.8 },
  ];

  try {
    const agents = await prisma.agent.findMany({
      where: {
        visibility: "PUBLIC",
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { shareSlug: true, updatedAt: true },
    });

    const agentRoutes: MetadataRoute.Sitemap = agents
      .filter((a) => a.shareSlug)
      .map((a) => ({
        url: `${base}/share/${a.shareSlug}`,
        lastModified: a.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));

    return [...staticRoutes, ...agentRoutes];
  } catch {
    // 构建环境无数据库访问权限时，仅返回静态路由，保证 next build 不中断
    return staticRoutes;
  }
}
