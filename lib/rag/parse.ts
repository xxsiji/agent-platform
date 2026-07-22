/**
 * 文档解析模块。
 *
 * RAG 管线的第一环：把上传的文件（Buffer）转成纯文本字符串。
 * MVP 只支持 txt 和 pdf，docx 以后再加。
 *
 * 重要修复（2026-07-22）：
 * 旧实现用 pdf-parse，在 Vercel Node runtime 加载即崩
 * （v2 依赖浏览器 DOMMatrix；v1 又强制读自带测试 PDF 导致 ENOENT），
 * 整个 /documents 路由 500。现改用 unpdf——专为 Node/Serverless 设计、
 * 无 DOM 依赖，且 PDF 解析仅在上传 pdf 时才动态加载，不连累 .txt 与列表。
 */

import { extractText, getDocumentProxy } from "unpdf";

/**
 * 解析纯文本：txt 直接按 UTF-8 解码即可。
 */
export function parseTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * 解析 PDF：用 unpdf 抽取正文文本（Serverless 安全，无 DOMMatrix 依赖）。
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = (text || "").toString();
    if (!clean.trim()) {
      throw new Error("PDF 解析结果为空，可能是扫描件或加密 PDF");
    }
    return clean;
  } catch (err) {
    // 解析失败（加密 / 损坏 / 编码问题等）→ 抛清晰错误，由上层标 FAILED
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF 解析失败：${msg}`);
  }
}

/**
 * 根据 MIME 类型路由到对应的解析器。
 *
 * 支持的格式：
 *   - text/plain      → parseTxt
 *   - application/pdf → parsePdf
 *
 * 其它格式统一抛错，错误信息由上层返回给用户（"暂不支持此格式"）。
 *
 * @param buffer   文件二进制内容
 * @param mimeType 文件的 MIME 类型，如 "application/pdf"
 * @returns        解析出的纯文本
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case "text/plain":
      return parseTxt(buffer);
    case "application/pdf":
      return await parsePdf(buffer);
    default:
      throw new Error("暂不支持此格式");
  }
}
