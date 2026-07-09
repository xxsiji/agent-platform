import { ImageResponse } from "next/og";

/**
 * 全站默认 OG 图（Open Graph Image）。
 *
 * 文件约定：app/opengraph-image.tsx
 * 覆盖根路由 / 以及所有未单独定义 opengraph-image 的页面。
 * 分享页 /share/[slug] 与探索页 /explore 各自有专属 OG 图。
 *
 * ImageResponse 基于 Satori，把 JSX 渲染成 SVG 再转 PNG。
 * 注意：只支持 flex 布局，不支持 Tailwind 类名，用内联 style。
 */
export const alt = "Agent 智能体平台";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
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

        {/* 中间：标题 + 描述 */}
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
            Agent 智能体平台
          </div>
          <div
            style={{
              color: "#cbd5e1",
              fontSize: "32px",
              lineHeight: 1.4,
              maxWidth: "800px",
            }}
          >
            创建、配置、对话与分享你的专属 AI Agent
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
          <span>立即体验社区创建的 AI 智能体</span>
        </div>
      </div>
    ),
    size
  );
}
