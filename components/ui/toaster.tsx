"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * 零依赖 Toast 通知系统。
 *
 * 用 React Context 实现：
 * - ToastProvider：包裹整个应用，并在右下角渲染 toast 容器
 * - useToast()：在任意子组件里调用，返回 { toast(message, type?) }
 *
 * 设计要点：
 * - 默认 type 为 "error"，也可传 "success" | "info"
 * - 每条 toast 在 3 秒后自动消失
 * - 健壮性：在 Provider 之外调用 useToast() 返回 no-op（不抛错），
 *   避免任何未预期的崩溃导致页面白屏
 */

type ToastType = "error" | "success" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  /** 弹出一条提示，type 默认 "error" */
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * 读取 toast 方法。
 * 在 Provider 外部调用时返回 no-op，绝不抛错。
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}

const TOAST_DURATION = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "error") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setItems((prev) => prev.filter((t) => t.id !== id)),
      TOAST_DURATION
    );
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={[
              "pointer-events-auto rounded-lg px-4 py-2.5 text-sm shadow-lg",
              t.type === "error"
                ? "bg-destructive text-destructive-foreground"
                : t.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-foreground text-background",
            ].join(" ")}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
