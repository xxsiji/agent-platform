"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Agent 创建/编辑表单(客户端组件)。
 *
 * 创建模式和编辑模式共用这个组件：
 * - 传入 agent 属性 → 编辑模式(预填数据，PATCH 提交)
 * - 不传 agent 属性 → 创建模式(空表单，POST 提交)
 *
 * 表单字段对应规格 §5.2：
 * - name: 名称(必填)
 * - description: 描述(选填)
 * - systemPrompt: 系统提示词(选填，定义 Agent 的人设和行为)
 * - model: 模型选择(deepseek-chat / deepseek-reasoner)
 * - temperature: 温度(0-2，越高越随机创意)
 * - topP: 核采样(0-1，另一种控制多样性的方式)
 * - maxTokens: 最大输出长度
 */

// Agent 的可编辑字段类型
type AgentFormData = {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  tags: string[];
};

// 可选的模型列表
const MODELS = [
  { value: "deepseek-chat", label: "DeepSeek Chat（通用对话）" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner（深度推理）" },
];

export function AgentForm({
  agent,
}: {
  agent?: AgentFormData & { id: string };
}) {
  const router = useRouter();
  const isEdit = !!agent;

  const [form, setForm] = useState<AgentFormData>({
    name: agent?.name ?? "",
    description: agent?.description ?? "",
    systemPrompt: agent?.systemPrompt ?? "",
    model: agent?.model ?? "deepseek-chat",
    temperature: agent?.temperature ?? 0.7,
    topP: agent?.topP ?? 1,
    maxTokens: agent?.maxTokens ?? 2048,
    tags: agent?.tags ?? [],
  });

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  // 通用字段更新
  function update<K extends keyof AgentFormData>(
    key: K,
    value: AgentFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // 添加标签：输入后按回车或逗号触发
  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !form.tags.includes(trimmed) && form.tags.length < 5) {
      update("tags", [...form.tags, trimmed]);
    }
    setTagInput("");
  }

  // 删除标签
  function removeTag(tag: string) {
    update("tags", form.tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("请填写 Agent 名称");
      return;
    }

    setLoading(true);

    try {
      if (isEdit && agent) {
        // 编辑模式：PATCH 更新
        const res = await fetch(`/api/agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "保存失败");
        }
        router.push("/agents");
        router.refresh();
      } else {
        // 创建模式：POST 新建
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "创建失败");
        }
        const created = await res.json();
        // 创建成功后直接跳到对话页
        router.push(`/agents/${created.id}/chat`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!agent) return;
    if (!confirm(`确定删除「${agent.name}」吗？删除后 30 天内可恢复。`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      router.push("/agents");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* 基本信息 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">基本信息</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">
            名称 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="例如：技术文档助手"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="简单描述这个 Agent 的用途，会显示在列表和分享页"
            rows={2}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tags">
            标签
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              最多 5 个，方便别人在探索广场找到
            </span>
          </Label>
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="输入标签后按回车添加（如：翻译、写作、编程）"
          />
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="systemPrompt">
            系统提示词
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              定义 Agent 的人设、能力和行为规则（支持 Markdown，上限 4000 字）
            </span>
          </Label>
          <Textarea
            id="systemPrompt"
            value={form.systemPrompt}
            onChange={(e) => update("systemPrompt", e.target.value)}
            placeholder={"例如：你是一个严谨的技术文档助手。\n- 回答基于官方文档\n- 代码示例用 TypeScript\n- 不确定时如实说明"}
            rows={8}
            maxLength={4000}
            className="font-mono text-xs"
          />
          <p className="text-right text-xs text-muted-foreground">
            {form.systemPrompt.length} / 4000
          </p>
        </div>
      </section>

      {/* 模型与参数 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">模型与参数</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="model">模型</Label>
          <select
            id="model"
            value={form.model}
            onChange={(e) => update("model", e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Temperature */}
          <div className="flex flex-col gap-2">
            <Label>
              Temperature
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {form.temperature.toFixed(1)}
              </span>
            </Label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={form.temperature}
              onChange={(e) => update("temperature", parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
            <p className="text-xs text-muted-foreground">越高越有创意，越低越确定</p>
          </div>

          {/* Top P */}
          <div className="flex flex-col gap-2">
            <Label>
              Top P
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {form.topP.toFixed(2)}
              </span>
            </Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.topP}
              onChange={(e) => update("topP", parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
            <p className="text-xs text-muted-foreground">核采样，控制多样性</p>
          </div>

          {/* Max Tokens */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxTokens">最大输出长度</Label>
            <Input
              id="maxTokens"
              type="number"
              min={100}
              max={8192}
              step={100}
              value={form.maxTokens}
              onChange={(e) => update("maxTokens", parseInt(e.target.value) || 2048)}
            />
            <p className="text-xs text-muted-foreground">单次回复最大 token 数</p>
          </div>
        </div>
      </section>

      {/* 错误提示 */}
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full text-destructive hover:bg-destructive/10 sm:w-auto"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              删除
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="flex-1 sm:flex-initial"
          >
            取消
          </Button>
          <Button type="submit" disabled={loading} className="flex-1 sm:flex-initial">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "保存修改" : "创建并对话"}
          </Button>
        </div>
      </div>
    </form>
  );
}
