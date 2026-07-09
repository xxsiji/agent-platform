"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  RotateCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";

/**
 * 知识库管理面板（Agent 编辑页用）。
 *
 * 功能：
 * - 列出该 Agent 知识库下的文档（文件名 / 状态 / 切片数 / 上传时间）
 * - 上传 .txt / .pdf（支持多选批量上传），用 XHR 显示上传进度
 * - 文档处于 PENDING / PROCESSING 时，每 3 秒轮询一次列表，直到 READY / FAILED
 * - 每个文档可删除（同时删 Storage 文件 + 向量）
 * - 「启用知识库」开关：关闭时对话不做 RAG 检索（即使有文档也不检索）
 *
 * 该组件是客户端组件，所有数据通过 /api/agents/[id]/documents 接口读写。
 */

type DocStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

type DocItem = {
  id: string;
  title: string;
  status: DocStatus;
  chunkCount: number;
  error: string | null;
  createdAt: string;
};

// 上传中的临时条目（尚未进入数据库，仅用于展示进度）
type UploadItem = {
  id: string;
  title: string;
  progress: number; // 0 ~ 100
  error?: string | null;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function KnowledgeBasePanel({
  agentId,
  initialEnableKnowledge,
}: {
  agentId: string;
  initialEnableKnowledge: boolean;
}) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [enabled, setEnabled] = useState(initialEnableKnowledge);
  const [savingToggle, setSavingToggle] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- 拉取文档列表 ----
  const refresh = useCallback(async (): Promise<DocItem[]> => {
    try {
      const res = await fetch(`/api/agents/${agentId}/documents`, {
        cache: "no-store",
      });
      if (!res.ok) return [];
      const data = await res.json();
      const list = (data.documents ?? []) as DocItem[];
      setDocs(list);
      return list;
    } catch {
      return [];
    }
  }, [agentId]);

  // ---- 轮询：有文档处于处理中时，每 3 秒刷新一次 ----
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const list = await refresh();
      const stillPending = list.some(
        (d) => d.status === "PENDING" || d.status === "PROCESSING"
      );
      if (!stillPending) stopPolling();
    }, 3000);
  }, [refresh, stopPolling]);

  // 首屏加载
  useEffect(() => {
    setLoadingList(true);
    refresh().finally(() => setLoadingList(false));
    return () => stopPolling();
  }, [refresh, stopPolling]);

  // ---- 单文件上传（XHR 带进度）----
  const uploadFile = useCallback(
    (file: File) => {
      return new Promise<void>((resolve) => {
        const tempId = "tmp-" + Math.random().toString(36).slice(2);
        setUploads((prev) => [
          ...prev,
          { id: tempId, title: file.name, progress: 0 },
        ]);

        const fd = new FormData();
        fd.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/agents/${agentId}/documents`);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) =>
              prev.map((u) => (u.id === tempId ? { ...u, progress: pct } : u))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // 成功：服务端已同步处理完（READY），交由列表刷新接管
            setUploads((prev) => prev.filter((u) => u.id !== tempId));
            resolve();
          } else if (xhr.status === 500) {
            // 处理失败：真实文档已标记为 FAILED，刷新后列表会显示原因
            setUploads((prev) => prev.filter((u) => u.id !== tempId));
            resolve();
          } else {
            // 其它错误（格式不对 / 过大 / 未登录等）：没有生成文档，保留临时条目提示
            let msg = "上传失败";
            try {
              const d = JSON.parse(xhr.responseText);
              msg = d.error || msg;
            } catch {
              /* ignore */
            }
            setUploads((prev) =>
              prev.map((u) =>
                u.id === tempId ? { ...u, progress: 100, error: msg } : u
              )
            );
            resolve();
          }
        };

        xhr.onerror = () => {
          // 网络错误：没有生成真实文档，保留临时条目并允许移除
          setUploads((prev) =>
            prev.map((u) =>
              u.id === tempId
                ? { ...u, progress: 100, error: "网络错误，上传失败" }
                : u
            )
          );
          resolve();
        };

        xhr.send(fd);
      });
    },
    [agentId]
  );

  // ---- 批量上传 ----
  const handleFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter((f) => /\.(txt|pdf)$/i.test(f.name));
      if (!valid.length) return;
      await Promise.all(valid.map((f) => uploadFile(f)));
      const list = await refresh();
      if (
        list.some(
          (d) => d.status === "PENDING" || d.status === "PROCESSING"
        )
      ) {
        startPolling();
      }
    },
    [uploadFile, refresh, startPolling]
  );

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // 允许再次选择同一文件
    if (files.length) handleFiles(files);
  }

  // ---- 删除文档 ----
  async function removeDoc(id: string) {
    if (!confirm("确定删除这个文档吗？相关向量也会一并删除。")) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/agents/${agentId}/documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      /* 失败则重新拉取还原 */
    }
    refresh();
  }

  // ---- 重新处理（PENDING / FAILED 可手动触发）----
  async function reprocessDoc(id: string) {
    try {
      const res = await fetch(
        `/api/agents/${agentId}/documents/${id}/reprocess`,
        { method: "POST" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || "重新处理失败");
      }
    } catch {
      toast("网络错误，重新处理失败");
    }
    const list = await refresh();
    if (
      list.some((d) => d.status === "PENDING" || d.status === "PROCESSING")
    ) {
      startPolling();
    }
  }

  function dismissUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }

  // ---- 切换知识库开关（即时保存）----
  async function toggleKnowledge(value: boolean) {
    setEnabled(value);
    setSavingToggle(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableKnowledge: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setEnabled(!value); // 失败回滚
    } finally {
      setSavingToggle(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-5">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <Database className="size-5" />
        <h2 className="text-lg font-semibold">知识库</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        上传文档，让 Agent 基于你的资料回答（RAG 检索）。
      </p>

      {/* 启用开关 */}
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">启用知识库</p>
          <p className="text-xs text-muted-foreground">
            开启后对话会检索这些文档；关闭则即使有文档也不检索。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={savingToggle}
          onClick={() => toggleKnowledge(!enabled)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
            enabled ? "bg-primary" : "bg-muted-foreground/30"
          )}
        >
          <span
            className={cn(
              "inline-block size-4 transform rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {!enabled && docs.length > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          知识库当前未启用，这些文档不会在对话中被检索。
        </p>
      )}

      {/* 上传区 */}
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
        <UploadCloud className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          支持 .txt / .pdf，可一次选择多个，单个文件 ≤ 20MB
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploads.length > 0}
          className="w-full sm:w-auto"
        >
          <UploadCloud className="size-4" />
          选择文件上传
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* 上传中的临时条目 */}
      {uploads.length > 0 && (
        <div className="flex flex-col gap-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-lg border border-dashed p-3"
            >
              <UploadCloud className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.title}</p>
                {u.error ? (
                  <p className="mt-1 text-xs text-destructive">{u.error}</p>
                ) : (
                  <>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {u.progress < 100
                        ? `上传中 ${u.progress}%`
                        : "处理中..."}
                    </p>
                  </>
                )}
              </div>
              {u.error && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="移除"
                  onClick={() => dismissUpload(u.id)}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 文档列表 */}
      <div className="flex flex-col gap-2">
        {loadingList && docs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            加载中...
          </p>
        ) : docs.length === 0 && uploads.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            还没有文档，上传 .txt / .pdf 让 Agent 学习你的资料。
          </p>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <DocStatusBadge
                    status={doc.status}
                    chunkCount={doc.chunkCount}
                  />
                  <span>· {formatTime(doc.createdAt)}</span>
                </div>
                {doc.status === "FAILED" && doc.error && (
                  <p className="mt-1 line-clamp-2 text-xs text-destructive">
                    {doc.error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {(doc.status === "PENDING" || doc.status === "FAILED") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="重新处理"
                    onClick={() => reprocessDoc(doc.id)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <RotateCw className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="删除文档"
                  onClick={() => removeDoc(doc.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/** 文档状态徽标 */
function DocStatusBadge({
  status,
  chunkCount,
}: {
  status: DocStatus;
  chunkCount: number;
}) {
  if (status === "READY") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" />
        就绪 · {chunkCount} 切片
      </span>
    );
  }
  if (status === "PENDING" || status === "PROCESSING") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
        <Loader2 className="size-3.5 animate-spin" />
        处理中...
      </span>
    );
  }
  // FAILED
  return (
    <span className="inline-flex items-center gap-1 font-medium text-destructive">
      <AlertCircle className="size-3.5" />
      失败
    </span>
  );
}
