# AI Agent 智能体平台

一个让任何人都能**创建、配置、对话使用并公开分享自己的 AI Agent** 的 Web 平台 —— 「创意工坊」模式：平台提供画布、颜料和画笔（模型、知识库、工具），画什么由用户决定。

> 独立开发项目（个人从 0 到 1 设计并实现全栈功能）。

- 🔗 **在线演示**：https://agent-platform-mu-seven.vercel.app
- 🎬 **演示视频**：_（部署在 Vercel，国内访问可能受网络影响，建议优先看视频）_
- 💻 **源码**：https://github.com/xxsiji/agent-platform

---

## ✨ 核心功能

| 模块 | 说明 |
| --- | --- |
| **Agent 创建与配置** | 可视化编辑页配置 system prompt、模型参数、知识库与工具开关 |
| **流式对话** | 基于 Vercel AI SDK 的 SSE 流式响应，多轮 Thread 持久化 |
| **RAG 知识库** | 上传 `.txt` / `.pdf` → 自动解析、切片、向量化（pgvector）、语义检索并在回答中引用来源 |
| **工具调用（Tool Calling）** | Agent 可勾选「联网搜索」「计算器」，对话中真实调用（非模拟） |
| **公开分享** | 生成分享链接，免登录访问页，任何人可直接对话 |
| **探索广场 + 社交互动** | 发现他人 Agent，支持点赞 / 收藏 / 评论 |
| **用量记录** | 按 token 记录每次调用，为后续计费/配额打基础 |

## 🏗️ 技术栈

- **前端**：Next.js 16（App Router）· React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui
- **后端 / 数据**：Supabase（PostgreSQL + pgvector + Auth + Storage）· Prisma 7
- **AI 编排**：Vercel AI SDK 7 · DeepSeek（对话）· 硅基流动 `BAAI/bge-large-zh-v1.5`（embedding，1024 维）
- **部署**：Vercel

## 💡 技术亮点

- **端到端 RAG 管线**：文档上传 → 解析 → 切片 → 向量化 → 存入 pgvector → 语义检索 → 上下文注入 → 带来源引用的回答，全链路自建。
- **安全的工具执行**：计算器使用 **Shunting-yard 算法**（中缀→RPN→求值）自行实现，**绝不使用 `eval` / `new Function`**，从根源防止 prompt 注入执行任意代码。
- **能力降级设计**：联网搜索按环境变量能力过滤，未配置 API Key 时**静默降级**而非报错，保证核心功能始终可用。
- **多轮工具调用**：通过 `stopWhen: isStepCount(5)` 控制 Agent 的工具调用步数，避免死循环。

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制模板并填入自己的值）
cp .env.example .env

# 3. 初始化数据库（需先在 Supabase 建好项目）
npx prisma migrate deploy
npx prisma generate

# 4. 启动开发服务器
npm run dev
```

打开 http://localhost:3000 查看。

## 🔐 环境变量

复制 `.env.example` 为 `.env` 并填入真实值。主要变量：

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | ✅ | Supabase Postgres 连接串（前者带连接池） |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase 服务端 Key（存储/后台操作） |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek 对话模型 Key |
| `EMBEDDING_API_KEY` | ✅ | 硅基流动 embedding Key（RAG 向量化） |
| `BRAVE_API_KEY` | ❌ | Brave Search Key，用于「联网搜索」工具；未配置则该工具自动禁用 |

> ⚠️ 切勿将真实 `.env` 提交到版本库（已在 `.gitignore` 中忽略）。

## 📁 项目结构

```
app/            # Next.js App Router 页面与 API 路由
components/     # UI 组件（含 dashboard 编辑面板、shadcn/ui）
lib/            # 核心逻辑：rag/（向量管线）、tools/（工具实现）等
prisma/         # 数据库 schema 与迁移
generated/      # Prisma Client 生成产物
```

## ⚠️ 已知问题

- 部分历史上传文档可能停留在 `PENDING` 状态（早期上传管线的异步处理未做失败兜底，正在修复：上传后同步处理 + 失败标记 + 重新处理按钮）。
- Supabase 数据库位于东京区域，国内访问有一定网络延迟（不影响功能正确性）。
- 线上域名为 `*.vercel.app`，国内网络环境下可能间歇性无法访问，建议通过演示视频查看效果。

## 📄 License

本项目基于 [MIT License](./LICENSE) 开源。
