// 将内部 ChatMessage 转换为发送给 /api/chat 的 OpenAI-compatible 消息格式。

import type { ChatMessage, ChatApiMessage, ChatApiContentPart } from "@/types";

/**
 * @param messages 会话消息
 * @param systemPrompt 预制 Prompt，非空时作为首条 system 消息前置
 */
export function toApiMessages(
  messages: ChatMessage[],
  systemPrompt?: string
): ChatApiMessage[] {
  const result: ChatApiMessage[] = [];

  if (systemPrompt && systemPrompt.trim()) {
    result.push({ role: "system", content: systemPrompt.trim() });
  }

  result.push(
    ...messages
      .filter((m) => !m.error) // 跳过错误占位消息
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
