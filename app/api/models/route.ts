import { NextRequest } from "next/server";
import { checkBaseUrlSafety } from "@/lib/ssrf";
import { normalizeBaseURL } from "@/lib/utils";
import { friendlyErrorFromStatus, friendlyErrorFromException } from "@/lib/api/errors";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RequestPayload {
  baseURL?: unknown;
  apiKey?: unknown;
}

function jsonError(title: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { title, message, status } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 从 /models 响应中提取模型 id 列表，兼容多种返回结构 */
function extractModelIds(data: unknown): string[] {
  const ids = new Set<string>();

  const pushId = (item: unknown) => {
    if (typeof item === "string") {
      ids.add(item);
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const id = obj.id ?? obj.name ?? obj.model;
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
  };

  if (Array.isArray(data)) {
    data.forEach(pushId);
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // OpenAI: { data: [...] }
    if (Array.isArray(obj.data)) obj.data.forEach(pushId);
    // Ollama: { models: [{ name }] }
    else if (Array.isArray(obj.models)) obj.models.forEach(pushId);
  }

  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

export async function POST(req: NextRequest) {
  let payload: RequestPayload;
  try {
    payload = (await req.json()) as RequestPayload;
  } catch {
    return jsonError("请求无效", "请求体不是合法的 JSON。", 400);
  }

  const { baseURL, apiKey } = payload;

  if (typeof baseURL !== "string" || !baseURL.trim()) {
    return jsonError("配置缺失", "缺少 Base URL。", 400);
  }
  if (typeof apiKey !== "string") {
    return jsonError("配置缺失", "缺少 API Token。", 400);
  }

  const normalized = normalizeBaseURL(baseURL);
  const safety = checkBaseUrlSafety(normalized);
  if (!safety.ok) {
    return jsonError(
      "无效的 API 地址",
      `该 Base URL 未通过安全校验：${safety.reason ?? "地址不被允许"}。`,
      400
    );
  }

  const modelsUrl = `${normalized}/models`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const resp = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      let detail = "";
      try {
        detail = await resp.text();
      } catch {
        // 忽略
      }
      const fe = friendlyErrorFromStatus(resp.status, detail);
      return jsonError(fe.title, fe.message, resp.status);
    }

    const data = await resp.json();
    const models = extractModelIds(data);

    if (models.length === 0) {
      return jsonError(
        "无可用模型",
        "该 API 未返回可用的模型列表，你仍可以手动填写 Model 名称。",
        404
      );
    }

    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const fe = friendlyErrorFromException(err);
    return jsonError(fe.title, fe.message, fe.status ?? 502);
  }
}
