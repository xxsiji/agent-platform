import { PDFParse } from "pdf-parse";

/**
 * 文档解析模块。
 *
 * RAG 管线的第一环：把上传的文件（Buffer）转成纯文本字符串。
 * MVP 只支持 txt 和 pdf，docx 以后再加。
 *
 * 注意：项目安装的是 pdf-parse v2（ESM 重写版），API 是 `PDFParse` 类，
 * 不再是 v1 的 `pdfParse(buffer)` 函数式调用。
 */

/**
 * 解析纯文本：txt 直接按 UTF-8 解码即可。
 */
export function parseTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * 解析 PDF：用 pdf-parse 的 PDFParse 类抽取正文文本。
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2：传入二进制数据，调用 getText() 拿纯文本
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || "";
  } catch (err) {
    // 解析失败（加密 / 损坏 / 编码问题等）→ 抛清晰错误，由上层标 FAILED
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF 解析失败：${msg}`);
  } finally {
    // 释放 worker / 内部资源，避免内存泄漏（destroy 自身也兜底）
    await parser.destroy().catch(() => {});
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
