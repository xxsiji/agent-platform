This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `BRAVE_API_KEY` | 否 | Brave Search API Key，用于「联网搜索」工具。未配置时该工具自动禁用，不影响其他功能。 |

> 其余变量（Supabase / 硅基流动 embedding 等）见项目 `.env` 配置。

## 功能与已知问题

- **工具（Tool Calling）**：Agent 编辑页可勾选「联网搜索」「计算器」。对话时 Agent 会真实调用这些工具（基于 Vercel AI SDK 的 tool calling）。
  - 计算器：开箱即用，无需任何配置。
  - 联网搜索：需自行配置 `BRAVE_API_KEY`；未配置则工具不生效（静默降级，不报错）。
- **RAG 知识库**：上传 .txt / .pdf，自动解析、切片、向量化（pgvector）、语义检索。
- **公开分享 / 探索广场 / 社交互动（点赞·收藏·评论）**：完整 Agent 创建与分发闭环。
- 已知问题：Supabase 数据库位于东京区域，跨国访问有一定延迟（不影响功能正确性）。
