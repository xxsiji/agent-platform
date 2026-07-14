import { prisma } from "@/lib/prisma";
import { parseDocument } from "./parse";
import { chunkText } from "./chunking";
import { storeDocumentEmbeddings } from "./storage";
import { downloadDocumentFile } from "./files";

/**
 * RAG 文档处理管线（解析 → 切片 → 向量化 → 入库）。
 *
 * 这是「上传接口」和「重新处理接口」共用的核心函数，设计要点：
 *
 * 1. 全程在调用方请求内【同步】完成（MVP 文档不大，同步足够且最可靠），
 *    不会出现「后台 job 因进程退出而丢失」的问题。
 * 2. 主链路（上传接口）直接把内存里的 buffer 传进来，不依赖 Supabase Storage，
 *    最稳；「重新处理」接口没有 buffer，才从 Storage 取回源文件。
 * 3. 进入前先把旧向量清掉（storeDocumentEmbeddings 内部 deleteMany），
 *    保证可重复执行（幂等）。
 * 4. 任何一步失败都会落到 catch，把 Document 标 FAILED 并记下【明确原因】，
 *    绝不会静默卡在 PENDING / 留下孤儿文档。
 * 5. 解析、向量化各带超时保护：worker 挂起或接口卡住时，转为可控的 FAILED，
 *    而不是无限期 PENDING。
 *
 * 权限校验由调用方（route handler）负责，本函数只认 documentId。
 */

// 解析超时（PDF 大文件 / worker 卡死保护）
const PARSE_TIMEOUT_MS = 90_000;
// 向量化超时（硅基流动接口卡顿保护）
const EMBED_TIMEOUT_MS = 120_000;

/** Promise 超时包装：超时即 reject，让外层 catch 标 FAILED */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label}超时（${Math.round(ms / 1000)}s）`)),
        ms
      )
    ),
  ]);
}

export type ProcessResult = {
  status: "READY" | "FAILED";
  chunkCount: number;
  error?: string;
};

/**
 * 处理指定文档（同步完成，终态为 READY 或 FAILED）。
 *
 * @param documentId 文档 id（调用前需已建好 Document 记录，且 sourceUrl 指向 Storage 中的源文件）
 * @returns 处理结果（status / chunkCount / error）
 */
export async function processDocument(
  documentId: string,
  buffer?: Buffer
): Promise<ProcessResult> {
  // 取文档元信息（sourceUrl / mimeType）
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw new Error("文档不存在");
  }

  // 立刻标记为处理中（让前端轮询能区分「正在处理」与「卡死待恢复」）
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "PROCESSING" },
  });

  try {
    // 主链路优先用调用方直接传入的内存 buffer（上传接口，避免绕 Supabase Storage）；
    // 未传入时（重新处理接口）才从 Storage 取回源文件。
    const buf = buffer ?? (await downloadDocumentFile(doc.sourceUrl ?? ""));

    // 1. 解析
    const text = await withTimeout(
      Promise.resolve(parseDocument(buf, doc.mimeType)),
      PARSE_TIMEOUT_MS,
      "解析"
    );

    const clean = text.trim();
    if (!clean) {
      // 扫描件 / 加密 PDF / 空文件 → 明确失败，而不是产出 0 切片 READY
      throw new Error(
        "文档内容为空，可能是扫描件、加密 PDF 或空文件，无法解析"
      );
    }

    // 2. 切片
    const chunks = chunkText(clean);
    if (chunks.length === 0) {
      throw new Error("文档无可切分的文本片段");
    }

    // 3. 向量化 + 入库（storeDocumentEmbeddings 内部先清旧向量，保证幂等）
    await withTimeout(
      storeDocumentEmbeddings(documentId, chunks),
      EMBED_TIMEOUT_MS,
      "向量化"
    );

    const updated = await prisma.document.findUnique({
      where: { id: documentId },
      select: { chunkCount: true },
    });

    return {
      status: "READY",
      chunkCount: updated?.chunkCount ?? chunks.length,
    };
  } catch (err) {
    // 任何失败：明确标 FAILED + 记录原因（绝不静默）
    const msg = err instanceof Error ? err.message : "文档处理失败";
    await prisma.document
      .update({
        where: { id: documentId },
        data: { status: "FAILED", error: msg },
      })
      .catch(() => {});
    return { status: "FAILED", chunkCount: 0, error: msg };
  }
}
