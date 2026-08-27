// 统一错误信息映射：把各种 HTTP 状态 / 网络异常翻译成友好中文提示。

export interface FriendlyError {
  title: string;
  message: string;
  status?: number;
}

/** 根据 HTTP 状态码生成友好错误 */
export function friendlyErrorFromStatus(
  status: number,
  detail?: string
): FriendlyError {
  const base = detail ? `\n\n${truncate(detail, 500)}` : "";
  switch (status) {
    case 400:
      return {
        title: "请求无效 (400)",
        message: "请求参数有误，请检查 Model 名称与消息内容是否正确。" + base,
        status,
      };
    case 401:
      return {
        title: "未授权 (401)",
        message:
          "API Token 无效或已过期。请检查 API 配置中的 Token 是否正确。" + base,
        status,
      };
    case 403:
      return {
        title: "禁止访问 (403)",
        message:
          "没有访问该资源的权限。可能是 Token 权限不足或该 Model 未开通。" +
          base,
        status,
      };
    case 404:
      return {
        title: "未找到 (404)",
        message:
          "接口地址或 Model 不存在。请检查 Base URL 是否正确（通常应以 /v1 结尾），以及 Model 名称是否有效。" +
          base,
        status,
      };
    case 408:
      return {
        title: "请求超时 (408)",
        message: "上游 API 响应超时，请稍后重试。" + base,
        status,
      };
    case 413:
      return {
        title: "内容过大 (413)",
        message: "请求内容过大，请减少消息长度或图片大小。" + base,
        status,
      };
    case 422:
      return {
        title: "无法处理 (422)",
        message: "请求内容无法被处理，请检查参数或 Model 是否支持该功能。" + base,
        status,
      };
    case 429:
      return {
        title: "请求过于频繁 (429)",
        message:
          "已触发速率限制或额度不足。请稍后重试，或检查账户余额与配额。" + base,
        status,
      };
    case 500:
      return {
        title: "服务器错误 (500)",
        message: "上游 API 服务器内部错误，请稍后重试。" + base,
        status,
      };
    case 502:
      return {
        title: "网关错误 (502)",
        message: "上游服务网关错误，请稍后重试。" + base,
        status,
      };
    case 503:
      return {
        title: "服务不可用 (503)",
        message: "上游服务暂时不可用，请稍后重试。" + base,
        status,
      };
    case 504:
      return {
        title: "网关超时 (504)",
        message: "上游服务响应超时，请稍后重试。" + base,
        status,
      };
    default:
      if (status >= 500) {
        return {
          title: `服务器错误 (${status})`,
          message: "上游 API 发生错误，请稍后重试。" + base,
          status,
        };
      }
      return {
        title: `请求失败 (${status})`,
        message: "API 请求失败，请检查配置后重试。" + base,
        status,
      };
  }
}

/** 根据抛出的异常（网络层）生成友好错误 */
export function friendlyErrorFromException(err: unknown): FriendlyError {
  const name = (err as { name?: string })?.name;
  const message = (err as { message?: string })?.message ?? "";

  if (name === "AbortError") {
    return { title: "已停止", message: "已停止生成。" };
  }
  if (name === "TimeoutError" || /timeout/i.test(message)) {
    return {
      title: "请求超时",
      message: "连接上游 API 超时。请检查 Base URL 是否可访问，或稍后重试。",
    };
  }
  if (
    /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|network/i.test(message)
  ) {
    return {
      title: "网络错误",
      message:
        "无法连接到目标 API。请检查 Base URL 是否正确、网络是否正常，以及该服务是否在线。",
    };
  }
  return {
    title: "请求失败",
    message: message ? truncate(message, 300) : "发生未知错误，请重试。",
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
