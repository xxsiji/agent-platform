"use client";

import { useState } from "react";
import { Calculator, Globe } from "lucide-react";

import { useToast } from "@/components/ui/toaster";

type ToolKey = "web_search" | "calculator";

const TOOL_OPTIONS: {
  key: ToolKey;
  label: string;
  desc: string;
}[] = [
  {
    key: "web_search",
    label: "联网搜索",
    desc: "调用 Brave 搜索回答时效性问题（需在 .env 配置 BRAVE_API_KEY，未配置则工具不生效）",
  },
  {
    key: "calculator",
    label: "计算器",
    desc: "对数学算式求值（加减乘除、括号、幂、取模），开箱即用，无需配置",
  },
];

/**
 * 工具开关面板（Agent 编辑页用）。
 *
 * 仿 KnowledgeBasePanel 的即时保存模式：勾选/取消即时 PATCH 到
 * /api/agents/[id]，把选中的工具 key 写入 agent.tools（string[]）；
 * 全不选时传 null。
 */
export function ToolsPanel({
  agentId,
  initialTools,
}: {
  agentId: string;
  initialTools: string[];
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>(initialTools);
  const [saving, setSaving] = useState(false);

  async function toggle(key: ToolKey, checked: boolean) {
    const next = checked
      ? [...selected, key]
      : selected.filter((k) => k !== key);

    // 乐观更新本地状态，体验即时
    setSelected(next);
    setSaving(true);

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: next.length ? next : null }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // 失败回滚
      setSelected(selected);
      toast("工具保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Calculator className="size-5" />
        <h2 className="text-lg font-semibold">工具</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        开启后，该 Agent 在对话中可真实调用对应工具（AI 决定何时使用）。
      </p>

      <div className="flex flex-col gap-2">
        {TOOL_OPTIONS.map((opt) => (
          <label
            key={opt.key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={selected.includes(opt.key)}
              disabled={saving}
              onChange={(e) => toggle(opt.key, e.target.checked)}
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {opt.key === "web_search" ? (
                  <Globe className="size-4 text-muted-foreground" />
                ) : (
                  <Calculator className="size-4 text-muted-foreground" />
                )}
                {opt.label}
              </p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
