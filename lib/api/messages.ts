// 将内部 ChatMessage 转换为发送给 /api/chat 的 OpenAI-compatible 消息格式。

import type { ChatMessage, ChatApiMessage, ChatApiContentPart } from "@/types";

/**
 * @param messages 会话消息
 * @param systemPrompt 预制 Prompt，非空时同时作为 system 消息与首条 user 消息前置
 *   （双保险：部分 API/模型对 system 消息遵循不佳，首条 user 消息可确保指令可见）
 */
export function toApiMessages(
  messages: ChatMessage[],
  systemPrompt?: string
): ChatApiMessage[] {
  const result: ChatApiMessage[] = [];

  const prompt = systemPrompt?.trim();
  if (prompt) {
    // 作为 system 消息
    result.push({ role: "system", content: prompt });
    // 同时作为第一条 user 消息（与界面展示一致）
    result.push({ role: "user", content: prompt });
  }

  result.push(
    ...messages
      .filter(
        (m) =>
          // 跳过错误占位消息
          !m.error &&
          // 跳过生成中的占位消息（含刷新页面后的 pending 残留）
          !m.pending &&
          // 跳过空内容消息（生成中断残留），用户空文本+图片的消息除外
          (m.content.trim().length > 0 ||
            (m.role === "user" && (m.images?.length ?? 0) > 0))
      )
      .map((m) => {
        // 带图片的 user 消息 -> 多模态 content
        if (m.role === "user" && m.images && m.images.length > 0) {
          const parts: ChatApiContentPart[] = [];
          if (m.content.trim()) {
            parts.push({ type: "text", text: m.content });
          }
          for (const img of m.images) {
            parts.push({ type: "image_url", image_url: { url: img.dataUrl } });
          }
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      })
  );

  return result;
}
