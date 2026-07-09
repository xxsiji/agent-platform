import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

/**
 * 动态 OG 卡片(Open Graph Image)
 *
 * 文件约定：app/share/[slug]/opengraph-image.tsx
 * Next.js 会自动为 /share/:slug 路由生成 OG 图片，
 * 并在 HTML <head> 里加上 <meta property="og:image"> 标签。
 *
 * 分享到微信/Twitter/Slack 等平台时，会显示这张图片作为预览。
 *
 * ImageResponse 基于 Satori，把 JSX 渲染成 SVG 再转 PNG。
 * 注意：只支持 flex 布局，不支持 Tailwind 类名，用内联 style。
 *
 * Next.js 16: params 是 Promise，要 await
 */

export const alt = "Agent 智能体平台";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const agent = await prisma.agent.findUnique({
    where: { shareSlug: slug },
    select: { name: true, description: true, visibility: true, deletedAt: true },
  });

  // 默认卡片(不存在或未公开的)
  const name = agent?.name || "Agent 不存在";
  const description =
    agent?.description || "创建你的专属 AI Agent，一键分享给他人使用";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* 顶部：Logo + 品牌名 */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              fontSize: "32px",
            }}
          >
            ✨
          </div>
          <div style={{ color: "#94a3b8", fontSize: "24px", fontWeight: 500 }}>
            Agent 智能体平台
          </div>
        </div>

        {/* 中间：Agent 名称 + 描述 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              color: "white",
              fontSize: "72px",
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: "900px",
            }}
          >
            {name}
          </div>
          <div
            style={{
              color: "#cbd5e1",
              fontSize: "32px",
              lineHeight: 1.4,
              maxWidth: "800px",
            }}
          >
            {description}
          </div>
        </div>

        {/* 底部：提示 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#64748b",
            fontSize: "24px",
          }}
        >
          <span>💬</span>
          <span>点击链接，立即与 AI 对话</span>
        </div>
      </div>
    ),
    size
  );
}
