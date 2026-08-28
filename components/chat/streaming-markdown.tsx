"use client";

import * as React from "react";
import { Markdown } from "@/components/chat/markdown";
import { LoadingDots } from "@/components/chat/loading-dots";
import { balanceMarkdown } from "@/lib/utils/markdown-balance";

/** 中英文常见标点 */
const PUNCT_RE = /[，。！？、；：,.!?;:…—～~]/;

/** 句子（标点）/段落（换行）后的停顿时长 */
function getPauseAfter(
  text: string,
  index: number,
  sentenceMs: number,
  paragraphMs: number
): number {
  if (index > 0) {
    const prev = text[index - 1];
    if (prev === "\n") return paragraphMs;
    if (PUNCT_RE.test(prev)) return sentenceMs;
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
  let sinceCommit = 0;
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
      sinceCommit = 0;
      i = end - 1;
    } else {
      sinceCommit++;
      // 长时间无标点（代码块/长URL等）：超过 40 字符强制提交，避免一直空白
      if (sinceCommit >= 40) {
        committed = i + 1;
        sinceCommit = 0;
      }
    }
  }

  return committed;
}

interface StreamingMarkdownProps {
  content: string;
  streaming: boolean;
  messageId: string;
  onReveal?: () => void;
  /** 打字节奏：字间隔毫秒（默认 70） */
  charMs?: number;
  /** 打字节奏：句子/标点停顿毫秒（默认 200） */
  sentenceMs?: number;
  /** 打字节奏：段落（换行）停顿毫秒（默认 200） */
  paragraphMs?: number;
  /** 冻结动画令牌：数值递增时立即停止逐字显示（保留当前已显示部分） */
  freezeToken?: number;
  /** 打字动画状态汇报（进行中/结束） */
  onTypingStateChange?: (typing: boolean) => void;
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
  charMs = 70,
  sentenceMs = 200,
  paragraphMs = 200,
  freezeToken = 0,
  onTypingStateChange,
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

  // 冻结标记：停止逐字显示，保留当前已显示部分
  const [frozen, setFrozen] = React.useState(false);

  React.useEffect(() => {
    resetProgress();
    setFrozen(false);
    prevContentRef.current = "";
  }, [messageId, resetProgress]);

  // 冻结动画：令牌递增时停止逐字显现（内容保留已显示部分）
  React.useEffect(() => {
    if (freezeToken > 0) {
      stopTypeLoop();
      setFrozen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freezeToken]);

  // 打字动画状态汇报（供外部把停止按钮保持为激活态）
  const typingActive =
    !frozen && content.length > 0 && visibleCount < content.length;
  React.useEffect(() => {
    onTypingStateChange?.(typingActive);
    return () => onTypingStateChange?.(false);
  }, [typingActive, onTypingStateChange]);

  React.useEffect(() => {
    const prev = prevContentRef.current;
    prevContentRef.current = content;

    if (content.length === 0) {
      resetProgress();
      // 内容被清空（如重新生成）：解除冻结，恢复打字
      setFrozen(false);
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
    // 冻结中：不启动打字循环
    if (frozen) return;

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

      charBudgetRef.current += elapsed / charMs;
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
        pauseMs = Math.max(
          pauseMs,
          getPauseAfter(text, i, sentenceMs, paragraphMs)
        );
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
  }, [
    content,
    streaming,
    onReveal,
    charMs,
    sentenceMs,
    paragraphMs,
    frozen,
  ]);

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
