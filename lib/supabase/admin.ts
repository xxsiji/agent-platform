import { createClient } from "@supabase/supabase-js";

/**
 * 服务端“管理员” Supabase 客户端（使用 service_role 密钥）。
 *
 * 和普通服务端客户端（lib/supabase/server.ts，用 anon key + 用户 Cookie）的区别：
 * - 这个客户端绕过 RLS 行级安全，拥有完整读写权限。
 * - 只能在服务端用（密钥绝不下发前端）。
 *
 * 用途：
 * - 创建 Storage bucket（建桶需要管理员权限，anon key 做不到）
 * - 服务端替用户上传/删除文档文件（不用操心 Storage 的 RLS 策略）
 *
 * 因为上传文档前我们已经在 API 路由里用 getCurrentUser 校验过登录和所有权，
 * 所以这里用 service_role 是安全的，不会越权。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase 管理员客户端未配置：缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
