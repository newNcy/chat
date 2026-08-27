// 全局共享类型定义

/** 单个 API 配置（保存在浏览器 localStorage） */
export interface AIConfig {
  id: string;
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  /** 该配置下可选的模型列表（Refresh Models 获取后缓存） */
  models?: string[];
  createdAt: number;
}

/** 应用偏好设置（对话外观等，保存在 localStorage） */
export interface AppPreferences {
  /** 对话中 AI 显示的名称 */
  aiName: string;
  /** AI 头像预设 id（见 AiAvatar 的 AVATAR_PRESETS）；"custom" 表示自定义头像 */
  aiAvatarId: string;
  /** 自定义头像（data URL），aiAvatarId 为 "custom" 时生效 */
  customAvatar?: string;
  /** 用户自己的昵称（对话中显示，默认"你"） */
  userName?: string;
  /** 用户头像："default"（默认样式）| 预设 id | "custom" */
  userAvatarId?: string;
  /** 用户自定义头像（data URL），userAvatarId 为 "custom" 时生效 */
  userCustomAvatar?: string;
  /** 聊天背景（data URL），为空使用默认纯色背景 */
  chatBackground?: string;
  /** 聊天背景显示强度 0-100，数值越高背景越明显 */
  chatBackgroundOpacity?: number;
  /** 预制 Prompt（system prompt），随每次聊天请求发送 */
  systemPrompt: string;
}

/** 消息中的图片附件（data URL） */
export interface ImageAttachment {
  id: string;
  /** data:image/...;base64,xxx */
  dataUrl: string;
  name: string;
}

export type MessageRole = "user" | "assistant" | "system";

/** 会话内单条消息 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  images?: ImageAttachment[];
  createdAt: number;
  /** 是否处于生成中（流式） */
  pending?: boolean;
  /** 错误信息（若生成失败） */
  error?: string;
}

/** 一个会话 */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  /** 该会话使用的配置 id（可选，默认用全局当前配置） */
  configId?: string;
  /** 该会话独立的偏好设置（AI/我的形象、背景、预制 Prompt） */
  preferences?: AppPreferences;
  createdAt: number;
  updatedAt: number;
}

/** 发送到 /api/chat 的请求体 */
export interface ChatRequestBody {
  baseURL: string;
  apiKey: string;
  model: string;
  messages: ChatApiMessage[];
}

/** OpenAI-compatible 消息格式（支持多模态 content） */
export interface ChatApiMessage {
  role: MessageRole;
  content: string | ChatApiContentPart[];
}

export type ChatApiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** /api/models 请求体 */
export interface ModelsRequestBody {
  baseURL: string;
  apiKey: string;
}

/** 统一的 API 错误响应 */
export interface ApiErrorResponse {
  error: {
    title: string;
    message: string;
    status?: number;
  };
}
