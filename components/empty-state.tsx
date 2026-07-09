import type { ReactNode } from "react";

/**
 * 可复用的空状态组件。
 *
 * 用于列表/看板无数据时的引导：图标 + 标题 + 描述 + 可选操作按钮。
 * 纯展示组件（无 "use client"），可在 Server Component 与 Client Component 中通用；
 * action 通常传入 `<Button asChild><Link/></Button>`。
 */
interface EmptyStateProps {
  /** 图标节点，默认包在圆角背景里 */
  icon?: ReactNode;
  /** 主标题（必填） */
  title: string;
  /** 辅助描述文案 */
  description?: ReactNode;
  /** 操作区域，如"创建 Agent"按钮 */
  action?: ReactNode;
  /** 追加的容器类名 */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className ?? ""}`}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="max-w-sm text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
