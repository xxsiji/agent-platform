import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteDocumentFile } from "@/lib/rag/files";

/**
 * 删除单个文档。
 *
 * DELETE /api/agents/[id]/documents/[docId]
 *
 * 清理三处：
 *   1. Supabase Storage 里的文件（best-effort，失败不阻断）
 *   2. "Embedding" 表里的向量（documentId 关联）—— 显式删，更稳妥
 *   3. "Document" 表记录
 *
 * 2 & 3 放在一个事务里，保证“要么都删、要么都不删”。
 * （Embedding 对 Document 是 onDelete: Cascade，删 Document 会自动带掉 Embedding，
 *   这里再显式 deleteMany 一次只是双保险。）
 *
 * 权限：登录 + Agent 主人 + 文档确实属于这个 Agent 的知识库。
 */

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id, docId } = await params;

  // 校验 Agent 所有权
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 确认文档属于该 Agent 的 KB（防止删别人的文档）
  const doc = await prisma.document.findFirst({
    where: { id: docId, kb: { agentId: id } },
  });
  if (!doc) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  // 1. 删 Storage 文件（best-effort）
  await deleteDocumentFile(doc.sourceUrl ?? "");

  // 2+3. 事务内删向量 + 删文档记录
  await prisma.$transaction([
    prisma.embedding.deleteMany({ where: { documentId: docId } }),
    prisma.document.delete({ where: { id: docId } }),
  ]);

  return NextResponse.json({ success: true });
}
