// 生成请求的可重试判定

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** 上游偶发异常（如 AI SDK 类型校验失败）通常可重试 */
const RETRYABLE_MESSAGE =
  /type validation failed|timeout|rate limit|overloaded|temporarily unavailable|econnreset|fetch failed|network/i;

export const GENERATION_MAX_RETRIES = 2;

export function isRetryableGenerationError(
  status?: number,
  message?: string
): boolean {
  if (status !== undefined && RETRYABLE_STATUS.has(status)) return true;
  if (message && RETRYABLE_MESSAGE.test(message)) return true;
  return false;
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
