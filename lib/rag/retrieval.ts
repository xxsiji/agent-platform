import { prisma } from "@/lib/prisma";
import { embedText } from "./embedding";

/**
 * RAG 检索结果的一条切片。
 * - content: 切片原文
 * - score:   相似度，1 - cosine_distance，范围 0~1（1 = 完全相同）
 */
export interface RetrievedChunk {
  content: string;
  score: number;
}

/**
 * 向量检索：根据用户问题，从这个 Agent 知识库里找出最相关的切片。
 *
 * 流程：
 * 1. embedText(query) 把问题向量化（1024 维）
 * 2. 用 pgvector 的余弦距离 `<=>` 在 Embedding 表上做最近邻检索
 * 3. 只查状态为 READY 的文档切片（还在处理中的不查）
 * 4. 取 topK 条，score = 1 - distance 转成 0~1 的相似度
 *
 * 注意：Prisma 不认识 vector 类型，这里必须用原始 SQL（$queryRaw）。
 * 向量参数以 `[0.1,0.2,...]` 的文本形式传入，再 `::vector` 强转。
 *
 * @param agentId 智能体 ID（检索范围限定在它自己的知识库）
 * @param query   用户问题（会先向量化）
 * @param topK    返回几条最相关切片，默认 5
 */
export async function searchKnowledge(
  agentId: string,
  query: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  // 1. 把用户问题向量化
  const queryVec = await embedText(query);
  const vecStr = `[${queryVec.join(",")}]`;

  // 2. pgvector 余弦距离检索 + JOIN 过滤 READY 文档
  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      e."content" AS "content",
      1 - (e."embedding" <=> ${vecStr}::vector) AS "score"
    FROM "Embedding" e
    JOIN "Document" d ON e."documentId" = d."id"
    JOIN "KnowledgeBase" kb ON d."kbId" = kb."id"
    WHERE kb."agentId" = ${agentId}
      AND d."status" = 'READY'
    ORDER BY e."embedding" <=> ${vecStr}::vector
    LIMIT ${topK}
  `;

  return rows;
}
