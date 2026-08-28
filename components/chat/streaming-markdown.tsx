"use client";

import * as React from "react";
import { Markdown } from "@/components/chat/markdown";
import { LoadingDots } from "@/components/chat/loading-dots";
import { balanceMarkdown } from "@/lib/utils/markdown-balance";

const CHARS_PER_SECOND = 1000 / 70; // 每字间隔 70ms
/** 标点后停顿 */
const PUNCT_PAUSE_MS = 200;

/** 中英文常见标点 */
const PUNCT_RE = /[，。！？、；：,.!?;:…—～~]/;

/** 标点后停顿 */
function getPauseAfter(text: string, index: number): number {
  if (index > 0 && PUNCT_RE.test(text[index - 1])) {
    return PUNCT_PAUSE_MS;
  }
  if (index > 0 && text[index - 1] === "\n") {
    return PUNCT_PAUSE_MS;
  }
  return 0;
}

/**
 * 已缓冲到「任意标点」的末尾下标（不含未完成片段）。
 * 流式结束时 commitAll=true，放出全部剩余内容。
 */
function getCommittedLength(text: string, commitAll: boolean): number {
  if (!text) return 0;
  if (commitAll) return text.length;

  let committed = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (PUNCT_RE.test(ch) || ch === "\n") {
      let end = i + 1;
      // 标点后紧跟的引号/括号/空白一并纳入
      while (
        end < text.length &&
        /[」』》"'”’）)\s]/.test(text[end]) &&
        !PUNCT_RE.test(text[end])
      ) {
        end++;
      }
      committed = end;
      i = end - 1;
    }
  }

  return committed;
}

interface StreamingMarkdownProps {
  content: string;
  streaming: boolean;
  messageId: string;
  onReveal?: () => void;
}

/**
 * 流式 Markdown：打字过程中实时渲染 Markdown。
 * 未闭合的标记（**、`、~~、``` 等）自动补全闭合，
 * 全程呈现渲染后的样式；完成后用原文渲染。
 */
export function StreamingMarkdown({
  content,
  streaming,
  messageId,
  onReveal,
}: StreamingMarkdownProps) {
  const [visibleCount, setVisibleCount] = React.useState(0);
  const contentRef = React.useRef(content);
  const prevContentRef = React.useRef(content);
  const countRef = React.useRef(0);
  const committedRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const lastTimeRef = React.useRef<number | null>(null);
  const pausedUntilRef = React.useRef(0);
  const charBudgetRef = React.useRef(0);

  contentRef.current = content;
  committedRef.current = getCommittedLength(content, !streaming);

  const stopTypeLoop = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
    pausedUntilRef.current = 0;
    charBudgetRef.current = 0;
  }, []);

  const showFull = React.useCallback(() => {
    stopTypeLoop();
    const len = contentRef.current.length;
    countRef.current = len;
    setVisibleCount(len);
  }, [stopTypeLoop]);

  const resetProgress = React.useCallback(() => {
    stopTypeLoop();
    countRef.current = 0;
    committedRef.current = 0;
    setVisibleCount(0);
  }, [stopTypeLoop]);

  React.useEffect(() => {
    resetProgress();
    prevContentRef.current = "";
  }, [messageId, resetProgress]);

  React.useEffect(() => {
    const prev = prevContentRef.current;
    prevContentRef.current = content;

    if (content.length === 0) {
      resetProgress();
      return;
    }

    const revealed = prev.slice(0, countRef.current);
    const isAppend =
      countRef.current === 0 ||
      content.startsWith(revealed) ||
      content.startsWith(prev);

    // 内容被整体替换（如切换变体）且非流式：直接全显
    if (!streaming && !isAppend) {
      showFull();
      return;
    }

    // 历史消息（非流式且从未开始打字）：直接全显
    if (!streaming && countRef.current === 0 && !prev) {
      showFull();
    }
  }, [content, streaming, showFull, resetProgress]);

  // 逐字动画：只显示已提交的完整句子，未完成的半句继续缓冲
  React.useEffect(() => {
    const tick = (now: number) => {
      if (now < pausedUntilRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const elapsed = Math.min(now - lastTimeRef.current, 100);
      lastTimeRef.current = now;

      const text = contentRef.current;
      const targetLen = committedRef.current;

      if (countRef.current >= targetLen) {
        if (targetLen < text.length || countRef.current < text.length) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        rafRef.current = null;
        lastTimeRef.current = null;
        charBudgetRef.current = 0;
        return;
      }

      charBudgetRef.current += (CHARS_PER_SECOND * elapsed) / 1000;
      const step = Math.floor(charBudgetRef.current);
      if (step < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      charBudgetRef.current -= step;

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
        charBudgetRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    committedRef.current = getCommittedLength(content, !streaming);

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [content, streaming, onReveal]);

  React.useLayoutEffect(() => {
    if (visibleCount < content.length || streaming) onReveal?.();
  }, [visibleCount, content.length, streaming, onReveal]);

  if (!content && visibleCount === 0) return null;

  const visibleText = content.slice(0, visibleCount);

  if (!visibleText) {
    return streaming ? (
      <div className="flex h-5 items-center">
        <LoadingDots />
      </div>
    ) : null;
  }

  // 打字过程中：实时 Markdown 渲染（未闭合标记自动补全，全程渲染后样式）
  // 完成后：完整原文渲染
  const displayText =
    visibleCount < content.length ? balanceMarkdown(visibleText) : content;

  return <Markdown content={displayText} />;
}
