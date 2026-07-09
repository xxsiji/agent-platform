import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { embedBatch } from "./embedding";

/**
 * 向量写入模块（RAG 管线第三环）。
 *
 * 把切片好的文本批量向量化，并写进 pgvector 的 "Embedding" 表。
 *
 * 关键点：pgvector 的 vector 列 Prisma 不原生支持，必须用原始 SQL（$executeRaw）
 * 写入。向量参数以文本数组形式 `[0.1,0.2,...]` 传进去，再 `::vector` 强转。
 */

/**
 * 把一篇文档的所有切片向量化并入库。
 *
 * @param documentId 文档 id（Document 表主键）
 * @param chunks     切片后的文本数组（chunkText 的输出）
 *
 * 流程：
 *   1. embedBatch 一次性把全部切片转成 1024 维向量（硅基流动 bge-large-zh-v1.5）
 *   2. 逐块 INSERT 到 "Embedding" 表（含 documentId / chunkIndex / content / embedding）
 *   3. 全部写完后，把 Document.status 置为 READY、chunkCount 置为切片数
 *
 * 注意：空文档（chunks 为空）也会把状态置为 READY，只是不产生向量。
 */
export async function storeDocumentEmbeddings(
  documentId: string,
  chunks: string[]
): Promise<void> {
  // 幂等：先清掉该文档已有的向量，保证「重新处理」重复执行不会残留旧切片
  await prisma.embedding.deleteMany({ where: { documentId } });

  if (chunks.length === 0) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY", chunkCount: 0 },
    });
    return;
  }

  // 1. 批量向量化
  const vectors = await embedBatch(chunks);

  // 2. 逐块写入 Embedding 表
  for (let i = 0; i < chunks.length; i++) {
    const vecStr = `[${vectors[i].join(",")}]`;
    await prisma.$executeRaw`
      INSERT INTO "Embedding" ("id", "documentId", "chunkIndex", "content", "embedding", "createdAt")
      VALUES (
        ${randomUUID()},
        ${documentId},
        ${i},
        ${chunks[i]},
        ${vecStr}::vector,
        now()
      )
    `;
  }

  // 3. 标记文档就绪 + 记录切片数
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "READY", chunkCount: chunks.length },
  });
}
