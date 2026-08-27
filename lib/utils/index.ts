import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 Tailwind 类名 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 生成唯一 id（浏览器与 node 均可用） */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 格式化时间分组标签 */
export function getDateGroupLabel(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  if (timestamp >= startOfToday) return "今天";
  if (timestamp >= startOfYesterday) return "昨天";
  if (timestamp >= startOfWeek) return "过去 7 天";
  return "更早";
}

/** 从首条用户消息生成会话标题 */
export function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "新对话";
  return clean.length > 30 ? clean.slice(0, 30) + "…" : clean;
}

/** 规范化 Base URL：去掉尾部斜杠 */
export function normalizeBaseURL(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
