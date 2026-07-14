import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureDocumentsBucket, uploadDocumentFile } from "@/lib/rag/files";
import { processDocument } from "@/lib/rag/process";

/**
 * 文档 API（某个 Agent 的知识库）
 *
 * GET  /api/agents/[id]/documents        → 列出该 Agent 知识库下的所有文档
 * POST /api/agents/[id]/documents        → 上传文件并走完 RAG 写入管线
 *
 * 两个接口都要求：登录 + 是 Agent 主人（否则 401 / 404，不暴露存在性）。
 */

// 单文件上限 20MB
const MAX_SIZE = 20 * 1024 * 1024;
// MVP 支持的 MIME（按扩展名兜底推断）
const ALLOWED_MIME = ["text/plain", "application/pdf"];

/** 从上传的 File 推断真实 MIME（有些浏览器 txt 的 type 会带 charset，或干脆为空） */
function resolveMime(file: File): string {
  const raw = (file.type || "").split(";")[0].trim().toLowerCase();
  if (raw) return raw;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt") return "text/plain";
  if (ext === "pdf") return "application/pdf";
  return "";
}

/**
 * Storage key 只允许 ASCII 安全字符（Supabase 会拒绝中文/空格等导致 Invalid key）。
 * 这里只对「存储路径里的文件名」做 ASCII 化，保留原扩展名；
 * Document.title 仍用原始文件名展示给用户。
 */
function safeStorageName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  return `${base || "file"}${ext}`;
}

// GET /api/agents/[id]/documents —— 文档列表
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 该 Agent 知识库下的全部文档（通过 kb.agentId 关联）
  const documents = await prisma.document.findMany({
    where: { kb: { agentId: id } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      chunkCount: true,
      mimeType: true,
      sizeBytes: true,
      error: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ documents });
}

// POST /api/agents/[id]/documents —— 上传 + 解析 + 切片 + 向量化 + 入库
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  // 取 Agent 并一并带出知识库（用于后面自动建 KB / 关联文档）
  const agent = await prisma.agent.findUnique({
    where: { id },
    include: { knowledgeBases: true },
  });
  if (!agent || agent.ownerId !== currentUser.db.id || agent.deletedAt) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  // 解析 multipart/form-data，取出 file 字段
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 });
  }

  // 校验格式
  const mime = resolveMime(file);
  if (!ALLOWED_MIME.includes(mime)) {
    return NextResponse.json(
      { error: "暂不支持此格式，目前仅支持 .txt 和 .pdf" },
      { status: 400 }
    );
  }

  // 校验大小
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "文件过大，上限 20MB" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // c. 获取或自动创建知识库（MVP 每个 Agent 一个 KB）
  let kb = agent.knowledgeBases[0];
  if (!kb) {
    kb = await prisma.knowledgeBase.create({
      data: { agentId: id, name: `${agent.name} 知识库` },
    });
  }

  // ★ 关键修复：先建 Document 行（PENDING），保证列表一定看得到这次上传。
  //   旧逻辑是先存 Storage 再建行——一旦 Storage/网络出错，行没建、列表永远空，
  //   前端只闪一下「上传失败」就消失，表现为「加载完啥也没加」。
  const doc = await prisma.document.create({
    data: {
      kbId: kb.id,
      title: file.name,
      mimeType: mime,
      sizeBytes: buffer.length,
      status: "PENDING",
    },
  });

  try {
    // a. 确保 bucket 存在
    await ensureDocumentsBucket();

    // b. 上传文件到 Storage（路径用 agentId/kbId/时间戳-文件名 组织；文件名 ASCII 化）
    const storagePath = `${id}/${kb.id}/${Date.now()}-${safeStorageName(file.name)}`;
    await uploadDocumentFile(storagePath, buffer, mime);

    // 回填源文件路径（processDocument 需要从 Storage 取回源文件）
    await prisma.document.update({
      where: { id: doc.id },
      data: { sourceUrl: storagePath },
    });

    // d+e. 同步走完 解析 → 切片 → 向量化 → 入库（详见 lib/rag/process.ts）
    // 成功 → READY；失败 → FAILED（带明确原因），绝不会卡在 PENDING
    const result = await processDocument(doc.id);

    if (result.status === "FAILED") {
      // processDocument 内部已把文档标 FAILED + 记录原因，直接返回错误
      return NextResponse.json(
        { error: result.error ?? "文档处理失败", documentId: doc.id },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        status: "READY",
        chunkCount: result.chunkCount,
      },
    });
  } catch (err) {
    // Storage 上传 / bucket 创建等前置步骤出错：文档已存在，标 FAILED 让用户看到原因，
    // 不再静默丢失（列表会显示「失败」+ 具体原因，可点重新处理）。
    const msg = err instanceof Error ? err.message : "上传或处理失败";
    await prisma.document
      .update({ where: { id: doc.id }, data: { status: "FAILED", error: msg } })
      .catch(() => {});
    return NextResponse.json({ error: msg, documentId: doc.id }, { status: 500 });
  }
}
