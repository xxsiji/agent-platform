import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 客户端单例。
 *
 * 为什么用单例？Next.js 开发模式有热重载，每次保存都会重新加载模块；
 * 若每次都 new PrismaClient()，会不断新建数据库连接、最终耗尽连接池。
 * 因此用 globalThis 缓存一个实例，整个进程复用。
 *
 * Prisma 7 必须通过 Driver Adapter 连接数据库：
 *   - 这里用 @prisma/adapter-pg，连接串取【连接池】地址 DATABASE_URL(端口 6543)。
 *   - 迁移用的【直连】地址 DIRECT_URL 在 prisma.config.ts 里。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL 未配置：请在 .env 中填入 Supabase 连接池地址" +
        "(Project Settings -> Database -> Connection string -> Transaction pooler，端口 6543)。"
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
