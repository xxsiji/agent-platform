// =============================================================================
// Prisma 7 配置文件
// Prisma 7 把数据库连接串从 schema.prisma 的 datasource 迁到了这里。
// =============================================================================

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // schema 位置
  schema: "prisma/schema.prisma",

  // 迁移文件目录
  migrations: {
    path: "prisma/migrations",
  },

  // Supabase 适配：这里的 url 供 Prisma CLI 做迁移用，应填【直连】地址(端口 5432)。
  // 应用运行时则用【连接池】地址 DATABASE_URL 走 driver adapter(见 lib/prisma.ts)。
  // 两者都在 Supabase 控制台 -> Connect 里能找到。
  //
  // 未配置时给本地占位串，让 prisma generate 这类不连库的命令能照常运行；
  // 真正做迁移前请在 .env 里填入真实 DIRECT_URL。
  datasource: {
    url: process.env.DIRECT_URL ?? "postgresql://localhost:5432/postgres",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
});
