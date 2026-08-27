"use client";

import * as React from "react";
import { Markdown } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";

const CHARS_PER_SECOND = 1.5;

/** 句末停顿（毫秒） */
function getPauseAfter(text: string, index: number): number {
  if (index >= 2 && text[index - 1] === "\n" && text[index - 2] === "\n") {
    return 320;
  }
  if (index > 0 && /[。！？.!?]/.test(text[index - 1])) {
    return 260;
  }
  if (index > 0 && /[；;\n]/.test(text[index - 1])) {
    return 180;
  }
  return 0;
}

/**
 * 尽量补全未闭合的 Markdown 标记，减少流式截断时的「源代码」闪烁。
 */
function stabilizeMarkdown(text: string): string {
  if (!text) return text;

  let out = text;

  const fenceCount = (out.match(/^```/gm) ?? []).length;
  if (fenceCount % 2 === 1) {
    out += "\n```";
  }

  const withoutBlocks = out.replace(/```[\s\S]*?```/g, "");
  const inlineTicks = (withoutBlocks.match(/`/g) ?? []).length;
  if (inlineTicks % 2 === 1) out += "`";

  const withoutCode = out
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "");
  const bold = (withoutCode.match(/\*\*/g) ?? []).length;
  if (bold % 2 === 1) out += "**";

  return out;
}

interface StreamingMarkdownProps {
  content: string;
  streaming: boolean;
  messageId: string;
  onReveal?: () => void;
}

export function StreamingMarkdown({
  content,
  streaming,
  messageId,
  onReveal,
}: StreamingMarkdownProps) {
  const [visibleCount, setVisibleCount] = React.useState(0);
  const contentRef = React.useRef(content);
  const countRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const lastTimeRef = React.useRef<number | null>(null);
  const pausedUntilRef = React.useRef(0);

  contentRef.current = content;

  const stopLoop = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
    pausedUntilRef.current = 0;
  }, []);

  const showFull = React.useCallback(() => {
    stopLoop();
    countRef.current = contentRef.current.length;
    setVisibleCount(contentRef.current.length);
  }, [stopLoop]);

  // 切换消息或分支内容：非流式时立即展示全文
  React.useEffect(() => {
    if (!streaming) {
      showFull();
      return;
    }
    // 重新生成开始：内容被清空
    if (content.length === 0) {
      stopLoop();
      countRef.current = 0;
      setVisibleCount(0);
    }
  }, [messageId, content, streaming, showFull, stopLoop]);

  // 仅在流式生成中做逐字动画
  React.useEffect(() => {
    if (!streaming) return;

    const tick = (now: number) => {
      if (now < pausedUntilRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const elapsed = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const text = contentRef.current;
      const targetLen = text.length;

      if (countRef.current < targetLen) {
        const step = Math.max(
          1,
          Math.round((CHARS_PER_SECOND * elapsed) / 1000)
        );
        const prevCount = countRef.current;
        const newCount = Math.min(targetLen, countRef.current + step);
        countRef.current = newCount;
        setVisibleCount(newCount);
        onReveal?.();

        let pauseMs = 0;
        for (let i = prevCount + 1; i <= newCount; i++) {
          pauseMs = Math.max(pauseMs, getPauseAfter(text, i));
        }
        if (pauseMs > 0 && newCount < targetLen) {
          pausedUntilRef.current = now + pauseMs;
          lastTimeRef.current = null;
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      rafRef.current = null;
      lastTimeRef.current = null;
      pausedUntilRef.current = 0;
    };

    if (countRef.current < contentRef.current.length && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [streaming, content, visibleCount, onReveal]);

  const isFullyRevealed = !streaming || visibleCount >= content.length;
  const visibleText = content.slice(0, visibleCount);
  const showFade = streaming && !isFullyRevealed && visibleText.length > 0;

  React.useLayoutEffect(() => {
    if (streaming) onReveal?.();
  }, [visibleCount, streaming, onReveal]);

  if (!content && !visibleText) return null;

  const renderText = isFullyRevealed
    ? content
    : stabilizeMarkdown(visibleText);

  return (
    <div className={cn("relative", showFade && "streaming-md-fade")}>
      <Markdown content={renderText} />
    </div>
  );
}
