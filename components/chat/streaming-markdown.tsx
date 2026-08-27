"use client";

import * as React from "react";
import { Markdown } from "@/components/chat/markdown";
import { LoadingDots } from "@/components/chat/loading-dots";

const CHARS_PER_SECOND = 12.5; // 每字间隔 80ms
/** 单字从透明到不透明的时长 */
const CHAR_FADE_MS = 240;
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

export function StreamingMarkdown({
  content,
  streaming,
  messageId,
  onReveal,
}: StreamingMarkdownProps) {
  const [visibleCount, setVisibleCount] = React.useState(0);
  const [, setFadePulse] = React.useState(0);
  const contentRef = React.useRef(content);
  const prevContentRef = React.useRef(content);
  const countRef = React.useRef(0);
  const committedRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const fadeRafRef = React.useRef<number | null>(null);
  const lastTimeRef = React.useRef<number | null>(null);
  const pausedUntilRef = React.useRef(0);
  const charBudgetRef = React.useRef(0);
  const revealedAtRef = React.useRef<Map<number, number>>(new Map());

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

  const stopFadeLoop = React.useCallback(() => {
    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  }, []);

  const startFadeLoop = React.useCallback(() => {
    if (fadeRafRef.current !== null) return;

    const loop = (now: number) => {
      let needs = false;
      for (const t of revealedAtRef.current.values()) {
        if (now - t < CHAR_FADE_MS) {
          needs = true;
          break;
        }
      }
      if (needs) {
        setFadePulse((p) => p + 1);
        fadeRafRef.current = requestAnimationFrame(loop);
      } else {
        fadeRafRef.current = null;
      }
    };

    fadeRafRef.current = requestAnimationFrame(loop);
  }, []);

  const markRevealed = React.useCallback(
    (from: number, to: number, now: number) => {
      for (let i = from; i < to; i++) {
        if (!revealedAtRef.current.has(i)) {
          revealedAtRef.current.set(i, now);
        }
      }
      startFadeLoop();
    },
    [startFadeLoop]
  );

  const showFull = React.useCallback(() => {
    stopTypeLoop();
    stopFadeLoop();
    const len = contentRef.current.length;
    const now = performance.now();
    for (let i = 0; i < len; i++) {
      revealedAtRef.current.set(i, now - CHAR_FADE_MS);
    }
    countRef.current = len;
    committedRef.current = len;
    setVisibleCount(len);
  }, [stopTypeLoop, stopFadeLoop]);

  const resetProgress = React.useCallback(() => {
    stopTypeLoop();
    stopFadeLoop();
    revealedAtRef.current.clear();
    countRef.current = 0;
    committedRef.current = 0;
    setVisibleCount(0);
  }, [stopTypeLoop, stopFadeLoop]);

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

    if (!streaming && !isAppend) {
      showFull();
      return;
    }

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
        // 还有未提交缓冲时继续等下一帧（新句子到达后继续打）
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
      markRevealed(prevCount, newCount, now);
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
  }, [content, streaming, visibleCount, onReveal, markRevealed]);

  const isFullyRevealed =
    !streaming && visibleCount >= content.length && content.length > 0;
  const visibleText = content.slice(0, visibleCount);
  const now = performance.now();

  const allFadesDone = React.useMemo(() => {
    if (!isFullyRevealed) return false;
    for (let i = 0; i < visibleCount; i++) {
      const t = revealedAtRef.current.get(i);
      if (t !== undefined && now - t < CHAR_FADE_MS) return false;
    }
    return true;
  }, [isFullyRevealed, visibleCount, now]);

  React.useLayoutEffect(() => {
    if (visibleCount < content.length || streaming) onReveal?.();
  }, [visibleCount, content.length, streaming, onReveal]);

  React.useEffect(() => {
    if (allFadesDone) stopFadeLoop();
  }, [allFadesDone, stopFadeLoop]);

  if (!content && !visibleText) return null;

  if (!visibleText) {
    return streaming ? (
      <div className="flex h-5 items-center">
        <LoadingDots />
      </div>
    ) : null;
  }

  // 打字过程中始终用同一套逐字布局，避免 Markdown/纯文本切换导致「先出再右移」
  // 全部显现且淡入结束后再切到完整 Markdown
  if (allFadesDone) {
    return <Markdown content={content} />;
  }

  return (
    <div className="markdown-body text-sm leading-5 break-words whitespace-pre-wrap text-foreground">
      {visibleText.split("").map((ch, idx) => {
        const revealed = revealedAtRef.current.get(idx) ?? now;
        const opacity = Math.min(1, Math.max(0, (now - revealed) / CHAR_FADE_MS));
        return (
          <span key={idx} style={{ opacity }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
}
