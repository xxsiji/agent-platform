import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * 获取当前登录用户，同时同步到业务数据库的 User 表。
 *
 * 为什么要同步？Supabase Auth 管的是 auth.users 表(在 Supabase 内部 schema)，
 * 我们的业务表(Agent/Thread/Message...)通过 ownerId 关联的是 public."User" 表。
 * 两张表需要对应起来——这里在用户首次访问时自动创建 User 记录。
 *
 * 关键设计：直接用 Supabase Auth 的 user.id(UUID) 作为我们 User 表的主键。
 * schema 里 User.id 是 @default(cuid())，但 Prisma 允许创建时手动传 id，
 * 所以传 UUID 进去就行，不需要改 schema。
 *
 * 这个函数在服务端组件和 API 路由里都能用。
 *
 * @returns { auth, db } 两个用户对象，或 null(未登录)
 */
// 用 React 的 cache() 包裹：同一次请求内（layout + page 同属一次渲染）多次调用
// 只实际执行 1 次，避免重复的 auth.getUser + prisma.user.upsert 东京往返。
// cache() 是请求级去重，跨请求不共享，因此不会串号（严禁用 unstable_cache）。
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();

  // getUser() 会校验 Cookie 里的 token，返回 Supabase Auth 用户
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // 同步到业务 User 表：不存在就创建，已存在就跳过(update: {} 空操作)
  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email!,
      name: (user.user_metadata?.name as string) || null,
      avatarUrl: (user.user_metadata?.avatar_url as string) || null,
    },
    update: {}, // 已存在则不更新，避免每次请求都写库
  });

  return { auth: user, db: dbUser };
});

/**
 * 要求用户必须登录，否则返回 null(调用方自行处理跳转或 401)。
 * 跟 getCurrentUser 的区别：这个返回值里 db 一定不为 null。
 */
export async function requireUser() {
  const current = await getCurrentUser();
  return current;
}
