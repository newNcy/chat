"use client";

import * as React from "react";
import { Markdown } from "@/components/chat/markdown";

const CHARS_PER_SECOND = 1.5;
const CHAR_FADE_MS = 580;
const FADE_CHAR_COUNT = 12;

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

function getCharOpacity(
  index: number,
  visibleCount: number,
  now: number,
  revealedAt: Map<number, number>,
  streaming: boolean
): number {
  const revealed = revealedAt.get(index) ?? now;
  const fadeIn = Math.min(1, (now - revealed) / CHAR_FADE_MS);
  let opacity = fadeIn;

  if (streaming && visibleCount > 0 && index >= visibleCount - FADE_CHAR_COUNT) {
    const posInTail = index - Math.max(0, visibleCount - FADE_CHAR_COUNT);
    const tailProgress =
      FADE_CHAR_COUNT <= 1 ? 1 : posInTail / (FADE_CHAR_COUNT - 1);
    opacity *= 1 - tailProgress * 0.82;
  }

  return opacity;
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
  const countRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const fadeRafRef = React.useRef<number | null>(null);
  const lastTimeRef = React.useRef<number | null>(null);
  const pausedUntilRef = React.useRef(0);
  const hasStreamedRef = React.useRef(false);
  const revealedAtRef = React.useRef<Map<number, number>>(new Map());

  contentRef.current = content;

  const resetProgress = React.useCallback(() => {
    countRef.current = 0;
    setVisibleCount(0);
    lastTimeRef.current = null;
    pausedUntilRef.current = 0;
    revealedAtRef.current.clear();
  }, []);

  const stopFadeLoop = React.useCallback(() => {
    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  }, []);

  const needsFadeFrame = React.useCallback(
    (count: number, now: number) => {
      if (streaming) return true;
      for (let i = 0; i < count; i++) {
        const t = revealedAtRef.current.get(i);
        if (t !== undefined && now - t < CHAR_FADE_MS) return true;
      }
      return false;
    },
    [streaming]
  );

  const startFadeLoop = React.useCallback(() => {
    if (fadeRafRef.current !== null) return;

    const loop = (now: number) => {
      const count = countRef.current;
      if (needsFadeFrame(count, now)) {
        setFadePulse((p) => p + 1);
        fadeRafRef.current = requestAnimationFrame(loop);
      } else {
        fadeRafRef.current = null;
      }
    };

    fadeRafRef.current = requestAnimationFrame(loop);
  }, [needsFadeFrame]);

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

  React.useEffect(() => {
    resetProgress();
    hasStreamedRef.current = false;
    return stopFadeLoop;
  }, [messageId, resetProgress, stopFadeLoop]);

  React.useEffect(() => {
    if (streaming) {
      hasStreamedRef.current = true;
      if (content.length === 0) {
        resetProgress();
      }
    }
  }, [streaming, content.length, resetProgress]);

  React.useEffect(() => {
    if (content.length < countRef.current) {
      resetProgress();
    }
  }, [content, resetProgress]);

  React.useEffect(() => {
    if (!streaming && !hasStreamedRef.current && content.length > 0) {
      countRef.current = content.length;
      setVisibleCount(content.length);
    }
  }, [streaming, content, messageId]);

  React.useEffect(() => {
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
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      rafRef.current = null;
      lastTimeRef.current = null;
      pausedUntilRef.current = 0;
    };

    const shouldAnimate =
      streaming || countRef.current < contentRef.current.length;
    if (shouldAnimate && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [streaming, content, visibleCount, onReveal, markRevealed]);

  const isFullyRevealed = !streaming && visibleCount >= content.length;

  React.useLayoutEffect(() => {
    if (!isFullyRevealed) onReveal?.();
  }, [visibleCount, isFullyRevealed, onReveal]);

  React.useEffect(() => {
    if (isFullyRevealed) stopFadeLoop();
  }, [isFullyRevealed, stopFadeLoop]);

  if (isFullyRevealed && content) {
    return <Markdown content={content} />;
  }

  if (!content) return null;

  const visibleText = content.slice(0, visibleCount);
  const now = performance.now();

  return (
    <div className="text-sm leading-5 break-words whitespace-pre-wrap text-foreground">
      {visibleText.split("").map((ch, i) => (
        <span
          key={i}
          style={{
            opacity: getCharOpacity(
              i,
              visibleCount,
              now,
              revealedAtRef.current,
              streaming
            ),
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}
