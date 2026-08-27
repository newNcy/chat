import { NextRequest } from "next/server";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type CoreMessage } from "ai";
import { checkBaseUrlSafety } from "@/lib/ssrf";
import { normalizeBaseURL } from "@/lib/utils";
import { friendlyErrorFromStatus, friendlyErrorFromException } from "@/lib/api/errors";
import type { ChatApiMessage } from "@/types";

// 使用 Node.js runtime（需要网络请求 + 完整 URL/IP 校验能力）
export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestPayload {
  baseURL?: unknown;
  apiKey?: unknown;
  model?: unknown;
  messages?: unknown;
}

function jsonError(
  title: string,
  message: string,
  status: number
): Response {
  return new Response(
    JSON.stringify({ error: { title, message, status } }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/** 校验并转换客户端消息为 AI SDK CoreMessage */
function toCoreMessages(messages: ChatApiMessage[]): CoreMessage[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content } as CoreMessage;
    }
    // 多模态：转换为 AI SDK 的 parts 结构
    const parts = m.content.map((part) => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      }
      return { type: "image" as const, image: new URL(part.image_url.url) };
    });
    // 仅 user 角色支持图片
    if (m.role === "user") {
      return { role: "user", content: parts } as CoreMessage;
    }
    // 其他角色退化为纯文本拼接
    const text = m.content
      .filter((p) => p.type === "text")
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("\n");
    return { role: m.role, content: text } as CoreMessage;
  });
}

export async function POST(req: NextRequest) {
  let payload: RequestPayload;
  try {
    payload = (await req.json()) as RequestPayload;
  } catch {
    return jsonError("请求无效", "请求体不是合法的 JSON。", 400);
  }

  const { baseURL, apiKey, model, messages } = payload;

  // 参数校验
  if (typeof baseURL !== "string" || !baseURL.trim()) {
    return jsonError("配置缺失", "缺少 Base URL，请先在设置中配置 API。", 400);
  }
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return jsonError("配置缺失", "缺少 API Token，请在设置中填写。", 400);
  }
  if (typeof model !== "string" || !model.trim()) {
    return jsonError("配置缺失", "缺少 Model，请在设置中填写或获取模型列表。", 400);
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("请求无效", "消息内容为空。", 400);
  }

  // SSRF 安全校验
  const normalized = normalizeBaseURL(baseURL);
  const safety = checkBaseUrlSafety(normalized);
  if (!safety.ok) {
    return jsonError(
      "无效的 API 地址",
      `该 Base URL 未通过安全校验：${safety.reason ?? "地址不被允许"}。`,
      400
    );
  }

  let coreMessages: CoreMessage[];
  try {
    coreMessages = toCoreMessages(messages as ChatApiMessage[]);
  } catch {
    return jsonError("请求无效", "消息格式不正确，可能包含无效的图片数据。", 400);
  }

  try {
    const provider = createOpenAICompatible({
      name: "user-provider",
      baseURL: normalized,
      apiKey,
    });

    const result = streamText({
      model: provider(model),
      messages: coreMessages,
      abortSignal: req.signal,
      onError: () => {
        // 静默：避免将上游错误细节（可能含敏感信息）写入日志
      },
    });

    // 流式返回；发生错误时转换成友好文本
    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        // 提取 HTTP 状态码（AI SDK 的 APICallError 通常带 statusCode）
        const status = (error as { statusCode?: number })?.statusCode;
        const responseBody = (error as { responseBody?: string })?.responseBody;
        if (typeof status === "number") {
          const fe = friendlyErrorFromStatus(status, responseBody);
          return `${fe.title}\n\n${fe.message}`;
        }
        const fe = friendlyErrorFromException(error);
        return `${fe.title}\n\n${fe.message}`;
      },
    });
  } catch (err) {
    const fe = friendlyErrorFromException(err);
    return jsonError(fe.title, fe.message, fe.status ?? 502);
  }
}
