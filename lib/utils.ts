import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn —— 合并 Tailwind 类名的工具函数。
 * clsx 负责处理条件类名(对象/数组)，tailwind-merge 负责解决冲突(如 px-2 px-4 → px-4)。
 * 所有 shadcn/ui 组件都依赖它。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
