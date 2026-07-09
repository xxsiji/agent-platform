import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase Storage 里的文档 bucket 名。
 * 所有上传的文档文件都放在这个 bucket 里。
 */
export const DOCUMENTS_BUCKET = "documents";

/**
 * 确保 documents bucket 存在（公开读、私有写）。
 *
 * 幂等：如果 bucket 已经存在，createBucket 会报错，这里 catch 住忽略即可。
 * 用 service_role 客户端调用，因为建桶需要管理员权限。
 *
 * 在第一次上传文档时调用一次即可；Supabase 的 bucket 是持久化的，
 * 不会随函数重启消失。
 */
export async function ensureDocumentsBucket(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage.createBucket(DOCUMENTS_BUCKET, {
    public: true, // 公开读：分享页/对话时不需要额外签名 URL
    fileSizeLimit: 20 * 1024 * 1024, // 单文件上限 20MB
  });
  // bucket 已存在 → 忽略错误
  if (error && !error.message.includes("already exists")) {
    // 其它错误（如网络）抛出来让上层处理
    throw error;
  }
}

/**
 * 上传文档文件到 Supabase Storage。
 *
 * @param path    对象路径，建议用 `${agentId}/${docId}-${filename}` 组织
 * @param buffer  文件二进制内容
 * @param mimeType 文件 MIME 类型（用于 Content-Type）
 * @returns       存储对象的路径（即 sourceUrl，删除时还要用）
 */
export async function uploadDocumentFile(
  path: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true, // 同名覆盖，重试时不会撞“已存在”
    });
  if (error) {
    throw new Error(`上传文件到 Storage 失败：${error.message}`);
  }
  return path;
}

/**
 * 从 Supabase Storage 下载文档文件（重新处理时用）。
 *
 * @param path 对象路径（即 Document.sourceUrl）
 * @returns 文件二进制内容 Buffer
 */
export async function downloadDocumentFile(path: string): Promise<Buffer> {
  if (!path) {
    throw new Error("文档缺少源文件路径，无法读取");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(`从 Storage 读取文件失败：${error?.message ?? "空响应"}`);
  }
  const arr = await data.arrayBuffer();
  return Buffer.from(arr);
}

/**
 * 从 Supabase Storage 删除文档文件（删除文档时清理用）。
 * 文件不存在也不报错（best-effort）。
 */
export async function deleteDocumentFile(path: string): Promise<void> {
  if (!path) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(DOCUMENTS_BUCKET).remove([path]);
  // 文件不存在等情况忽略，不阻断主流程
  if (error) {
    console.warn(`[RAG] 删除 Storage 文件失败（已忽略）: ${path}`, error.message);
  }
}
