/**
 * 流式渲染时的 Markdown 标记自动补全：
 * 未闭合的 **、`、~~、``` 等标记临时补全闭合，
 * 使打字过程中始终呈现渲染后的样式（而非源码）。
 * 仅用于显示层，不修改真实内容。
 */
export function balanceMarkdown(src: string): string {
  if (!src) return src;

  let inFence = false;
  let fenceChar = "";
  let bold = 0;
  let strike = 0;
  let inlineCode = 0;

  const lines = src.split("\n");
  for (const line of lines) {
    // 围栏（``` 或 ~~~）：成对开关
    const fenceMatch = /^\s{0,3}(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceChar = fenceMatch[1][0];
      } else if (fenceMatch[1][0] === fenceChar) {
        inFence = false;
      }
      continue;
    }
    // 围栏内的标记是字面量，不参与计数
    if (inFence) continue;

    bold += (line.match(/\*\*/g) || []).length;
    strike += (line.match(/~~/g) || []).length;
    inlineCode += (line.match(/`/g) || []).length;
  }

  let result = src;
  // 未闭合的代码块围栏：补闭合（其后追加的行内补全位于围栏外）
  if (inFence) result += "\n```";
  // 未配对的行内标记：尾部补全
  if (bold % 2 === 1) result += "**";
  if (strike % 2 === 1) result += "~~";
  if (inlineCode % 2 === 1) result += "`";
  return result;
}
