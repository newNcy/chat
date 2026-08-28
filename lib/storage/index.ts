// localStorage 存储层：API 配置、当前选择、会话记录、偏好设置。
// 全部数据仅保存在用户浏览器本地，不会上传到服务器。

import type { AIConfig, AppPreferences, Conversation } from "@/types";

export const STORAGE_KEYS = {
  configs: "ai-chat-configs",
  currentConfigId: "ai-chat-current-config",
  conversations: "ai-chat-conversations",
  preferences: "ai-chat-preferences",
  theme: "ai-chat-theme",
} as const;

const isBrowser = () => typeof window !== "undefined";

/** 安全读取并解析 JSON */
function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 存储写入的结果 */
export interface WriteResult {
  ok: boolean;
  /** 是否因为容量不足而失败 */
  quotaExceeded?: boolean;
  error?: string;
}

/** 安全写入 JSON，处理容量不足等异常 */
function writeJSON(key: string, value: unknown): WriteResult {
  if (!isBrowser()) return { ok: false, error: "非浏览器环境" };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    const err = e as { name?: string };
    const quotaExceeded =
      err?.name === "QuotaExceededError" ||
      err?.name === "NS_ERROR_DOM_QUOTA_REACHED";
    return {
      ok: false,
      quotaExceeded,
      error: quotaExceeded ? "本地存储空间不足" : "写入本地存储失败",
    };
  }
}

// ---------- API 配置 ----------

export function loadConfigs(): AIConfig[] {
  const list = readJSON<AIConfig[]>(STORAGE_KEYS.configs, []);
  return Array.isArray(list) ? list : [];
}

export function saveConfigs(configs: AIConfig[]): WriteResult {
  return writeJSON(STORAGE_KEYS.configs, configs);
}

export function loadCurrentConfigId(): string | null {
  return readJSON<string | null>(STORAGE_KEYS.currentConfigId, null);
}

export function saveCurrentConfigId(id: string | null): WriteResult {
  return writeJSON(STORAGE_KEYS.currentConfigId, id);
}

// ---------- 会话记录 ----------

export function loadConversations(): Conversation[] {
  const list = readJSON<Conversation[]>(STORAGE_KEYS.conversations, []);
  return Array.isArray(list) ? list : [];
}

export function saveConversations(conversations: Conversation[]): WriteResult {
  const result = writeJSON(STORAGE_KEYS.conversations, conversations);
  // 容量不足时，尝试逐步丢弃最旧会话后重试
  if (!result.ok && result.quotaExceeded && conversations.length > 1) {
    const trimmed = [...conversations].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    while (trimmed.length > 1) {
      trimmed.pop();
      const retry = writeJSON(STORAGE_KEYS.conversations, trimmed);
      if (retry.ok) {
        return { ok: true, quotaExceeded: true, error: "存储空间不足，已自动清理最旧的会话" };
      }
    }
  }
  return result;
}

// ---------- 偏好设置 ----------

/** 偏好设置的默认值 */
export const DEFAULT_PREFERENCES: AppPreferences = {
  aiName: "AI",
  aiAvatarId: "bot",
  customAvatar: "",
  userName: "你",
  userAvatarId: "default",
  userCustomAvatar: "",
  chatBackground: "",
  chatBackgroundOpacity: 20,
  typingCharMs: 70,
  typingSentenceMs: 200,
  typingParagraphMs: 200,
  systemPrompt: "",
};

/** 数值字段安全解析（带范围约束） */
function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function loadPreferences(): AppPreferences {
  const p = readJSON<Partial<AppPreferences>>(
    STORAGE_KEYS.preferences,
    {}
  );
  const opacity =
    typeof p.chatBackgroundOpacity === "number" && Number.isFinite(p.chatBackgroundOpacity)
      ? Math.max(0, Math.min(100, Math.round(p.chatBackgroundOpacity)))
      : DEFAULT_PREFERENCES.chatBackgroundOpacity;
  return {
    aiName:
      typeof p.aiName === "string" && p.aiName.trim() ? p.aiName : DEFAULT_PREFERENCES.aiName,
    aiAvatarId:
      typeof p.aiAvatarId === "string" && p.aiAvatarId
        ? p.aiAvatarId
        : DEFAULT_PREFERENCES.aiAvatarId,
    customAvatar: typeof p.customAvatar === "string" ? p.customAvatar : "",
    userName:
      typeof p.userName === "string" && p.userName.trim()
        ? p.userName
        : DEFAULT_PREFERENCES.userName,
    userAvatarId:
      typeof p.userAvatarId === "string" && p.userAvatarId
        ? p.userAvatarId
        : DEFAULT_PREFERENCES.userAvatarId,
    userCustomAvatar:
      typeof p.userCustomAvatar === "string" ? p.userCustomAvatar : "",
    chatBackground: typeof p.chatBackground === "string" ? p.chatBackground : "",
    chatBackgroundOpacity: opacity,
    typingCharMs: clampNumber(
      p.typingCharMs,
      DEFAULT_PREFERENCES.typingCharMs!,
      10,
      300
    ),
    typingSentenceMs: clampNumber(
      p.typingSentenceMs,
      DEFAULT_PREFERENCES.typingSentenceMs!,
      0,
      1500
    ),
    typingParagraphMs: clampNumber(
      p.typingParagraphMs,
      DEFAULT_PREFERENCES.typingParagraphMs!,
      0,
      2000
    ),
    systemPrompt:
      typeof p.systemPrompt === "string" ? p.systemPrompt : "",
  };
}

export function savePreferences(preferences: AppPreferences): WriteResult {
  return writeJSON(STORAGE_KEYS.preferences, preferences);
}
