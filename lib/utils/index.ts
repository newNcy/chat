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

import type { Conversation } from "@/types";

/** 会话列表预览：最后一条有效回复的开头 */
export function getConversationLastPreview(
  conv: Conversation,
  maxLen = 36
): string {
  const messages = conv.messages.filter((m) => !m.error && m.content.trim());
  if (messages.length === 0) return "还没有消息";

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      const clean = messages[i].content.trim().replace(/\s+/g, " ");
      return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean;
    }
  }

  const last = messages[messages.length - 1].content.trim().replace(/\s+/g, " ");
  return last.length > maxLen ? last.slice(0, maxLen) + "…" : last;
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
