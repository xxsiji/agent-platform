import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { processDocument } from "@/lib/rag/process";

/**
 * 重新处理单个文档。
 *
 * POST /api/agents/[id]/documents/[docId]/reprocess
 *
 * 用途：
 * - 上传时因进程退出/请求中断而卡在 PENDING 的孤儿文档，可手动触发重新解析；
 * - 解析/向量化失败（FAILED）的文档，修正后可重新跑一遍管线；
 * - 已 READY 的文档也可重跑（幂等：会先清掉旧向量再重新入库，例如模型维度变更后）。
 *
 * 权限：登录 + Agent 主人 + 文档确实属于该 Agent 的知识库。
 */
export async function POST(
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

  // 确认文档属于该 Agent 的 KB（防止处理别人的文档）
  const doc = await prisma.document.findFirst({
    where: { id: docId, kb: { agentId: id } },
  });
  if (!doc) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  // 正在处理中则不允许重复触发，避免并发冲突
  if (doc.status === "PROCESSING") {
    return NextResponse.json(
      { error: "该文档正在处理中，请稍候" },
      { status: 409 }
    );
  }

  // 复用同一份管线，同步处理完
  const result = await processDocument(docId);

  return NextResponse.json(
    {
      success: result.status === "READY",
      status: result.status,
      chunkCount: result.chunkCount,
      error: result.error,
    },
    { status: result.status === "READY" ? 200 : 500 }
  );
}
