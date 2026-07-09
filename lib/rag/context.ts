import type { RetrievedChunk } from "./retrieval";

/**
 * 把检索到的切片拼成一段「知识上下文」，准备注入 system prompt。
 *
 * 格式：每条切片用 [序号] 标出，方便模型引用；结尾加一句防幻觉提示，
 * 让模型在检索内容不足以回答问题时不瞎编。
 *
 * 如果检索结果为空（没有相关知识），返回空字符串——
 * 调用方会据此跳过 RAG 注入，直接用原始 systemPrompt。
 *
 * @param chunks searchKnowledge 返回的切片列表
 */
export function buildRagContext(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return "";
  }

  const body = chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
    .join("\n\n");

  return `以下是从知识库中检索到的相关内容，请参考回答用户问题：

${body}

注意：如果上述内容不足以回答用户的问题，请如实告知你不知道，不要编造信息。`;
}
