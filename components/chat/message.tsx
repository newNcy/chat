"use client";

import * as React from "react";
import { Check, Copy, RefreshCw, AlertCircle } from "lucide-react";
import { Markdown } from "@/components/chat/markdown";
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
}

export const MessageItem = React.memo(function MessageItem({
  message,
  canRegenerate,
  onRegenerate,
  streaming,
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
          <div className="max-w-full whitespace-pre-wrap break-words rounded-2xl bg-secondary px-4 py-2.5 text-sm leading-7">
            {message.content}
          </div>
        ) : (
          <>
            {message.content ? (
              <div className="max-w-full rounded-2xl bg-secondary px-4 py-2.5">
                <Markdown content={message.content} />
              </div>
            ) : streaming ? (
              <div className="rounded-2xl bg-secondary px-4 py-3">
                <div className="flex h-5 items-center gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* 操作栏 */}
        {!message.pending && !streaming && (message.content || message.error) && (
          <div
            className={cn(
              "flex items-center gap-1 pt-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100",
              isUser && "justify-end"
            )}
          >
            {!message.error && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
            {!isUser && canRegenerate && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="重新生成"
                title="重新生成"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新生成
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
