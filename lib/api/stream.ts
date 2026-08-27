// 解析 Vercel AI SDK 的 Data Stream 协议。
//
// AI SDK 的 toDataStreamResponse 返回的每一行形如：
//   0:"文本增量"          -> 文本内容
//   3:"错误信息"          -> 错误（我们通过 getErrorMessage 返回友好文本）
//   e:{...} / d:{...}     -> 结束/元数据
// 我们只关心文本增量(0) 与错误(3)。

export interface StreamHandlers {
  onText: (delta: string) => void;
  onError: (message: string) => void;
}

/** 从一行中解析并分发。返回是否为错误行。 */
function handleLine(line: string, handlers: StreamHandlers): void {
  const idx = line.indexOf(":");
  if (idx <= 0) return;
  const type = line.slice(0, idx);
  const rest = line.slice(idx + 1);

  if (type === "0") {
    // 文本增量，值是 JSON 字符串
    try {
      const text = JSON.parse(rest) as string;
      handlers.onText(text);
    } catch {
      // 忽略无法解析的行
    }
  } else if (type === "3") {
    // 错误
    try {
      const msg = JSON.parse(rest) as string;
      handlers.onError(msg);
    } catch {
      handlers.onError(rest);
    }
  }
  // 其它类型（e/d/f/8/9/a...）忽略
}

/**
 * 读取并解析 data stream。
 * @throws AbortError 当 signal 中断时（由 fetch 抛出）
 */
export async function readDataStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) handleLine(line, handlers);
      }
    }
    // 处理残余
    const tail = buffer.trim();
    if (tail) handleLine(tail, handlers);
  } finally {
    reader.releaseLock();
  }
}
