"use client";

import * as React from "react";
import { Check, Copy, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { StreamingMarkdown } from "@/components/chat/streaming-markdown";
import { LoadingDots } from "@/components/chat/loading-dots";
import { AiAvatar, UserAvatar } from "@/components/chat/ai-avatar";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface MessageItemProps {
  message: ChatMessage;
  /** 是否是最后一条 assistant 消息（可重新生成） */
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  /** 当前是否正在流式生成 */
  streaming?: boolean;
  /** 分支导航：当前分支序号（1-based） */
  variantIndex?: number;
  /** 分支总数 */
  variantCount?: number;
  onPrevVariant?: () => void;
  onNextVariant?: () => void;
  /** 流式文字显现时跟随滚动 */
  onStreamScroll?: () => void;
  /** 冻结打字动画令牌（停止逐字显示） */
  skipAnimToken?: number;
  /** 打字动画状态汇报 */
  onTypingStateChange?: (typing: boolean) => void;
}

export const MessageItem = React.memo(function MessageItem({
  message,
  canRegenerate,
  onRegenerate,
  streaming,
  variantIndex,
  variantCount,
  onPrevVariant,
  onNextVariant,
  onStreamScroll,
  skipAnimToken,
  onTypingStateChange,
}: MessageItemProps) {
  const [copied, setCopied] = React.useState(false);
  const { preferences } = useAppStore();
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 忽略
    }
  };

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group/msg flex gap-3 px-4 py-4 sm:px-6",
        // 用户消息整体右对齐，头像在右
        isUser && "flex-row-reverse"
      )}
    >
      {/* 头像 */}
      {isUser ? (
        <UserAvatar
          avatarId={preferences.userAvatarId ?? "default"}
          customAvatar={preferences.userCustomAvatar}
          className="h-9 w-9"
        />
      ) : (
        <AiAvatar
          avatarId={preferences.aiAvatarId}
          customAvatar={preferences.customAvatar}
          className="h-9 w-9"
        />
      )}

      {/* 内容：名称已在顶部顶栏展示，消息内仅保留头像与内容 */}
      <div
        className={cn(
          "min-w-0 max-w-full flex-1 space-y-1.5",
          // 气泡收缩到内容宽度：用户靠右、AI 靠左（短内容不占满布局）
          isUser ? "flex flex-col items-end" : "flex flex-col items-start"
        )}
      >
        {/* 用户消息不显示名字，AI 名称已在顶部顶栏展示 */}

        {/* 图片附件 */}
        {message.images && message.images.length > 0 && (
          <div
            className={cn(
              "flex max-w-full flex-wrap gap-2",
              isUser && "justify-end"
            )}
          >
            {message.images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.dataUrl}
                alt={img.name}
                className="max-h-48 rounded-lg border object-contain"
              />
            ))}
          </div>
        )}

        {/* 文本内容 */}
        {message.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="whitespace-pre-wrap break-words text-foreground">
              {message.error}
            </div>
          </div>
        ) : isUser ? (
          /* 用户消息：右对齐气泡 */
          <div className="max-w-full min-h-9 whitespace-pre-wrap break-words rounded-lg bg-secondary px-3.5 py-2 text-sm leading-5">
            {message.content}
          </div>
        ) : (
          <>
            {message.content ? (
              <div className="max-w-full min-h-9 rounded-lg bg-secondary px-3.5 py-2">
                <StreamingMarkdown
                  content={message.content}
                  streaming={!!streaming}
                  messageId={message.id}
                  onReveal={onStreamScroll}
                  charMs={preferences.typingCharMs}
                  sentenceMs={preferences.typingSentenceMs}
                  paragraphMs={preferences.typingParagraphMs}
                  freezeToken={skipAnimToken}
                  onTypingStateChange={onTypingStateChange}
                />
              </div>
            ) : streaming || message.pending ? (
              <div className="flex min-h-9 items-center rounded-lg bg-secondary px-3.5 py-2">
                <LoadingDots />
              </div>
            ) : null}
          </>
        )}

        {/* 操作栏 */}
        {!message.pending && !streaming && (message.content || message.error) && (
          <div
            className={cn(
              "flex items-center gap-1 pt-0.5",
              isUser && "justify-end"
            )}
          >
            {!isUser && variantCount && variantCount > 1 && variantIndex && (
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={onPrevVariant}
                  disabled={variantIndex <= 1}
                  className="rounded p-1 transition-colors hover:bg-accent hover:text-foreground active:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="上一个回答"
                  title="上一个回答"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[2.5rem] text-center tabular-nums">
                  {variantIndex}/{variantCount}
                </span>
                <button
                  type="button"
                  onClick={onNextVariant}
                  disabled={variantIndex >= variantCount}
                  className="rounded p-1 transition-colors hover:bg-accent hover:text-foreground active:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="下一个回答"
                  title="下一个回答"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {!isUser && canRegenerate && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
                aria-label="重新生成"
                title="重新生成"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新生成
              </button>
            )}
            {!message.error && (
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent",
                  "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100"
                )}
                aria-label="复制消息"
                title="复制"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
