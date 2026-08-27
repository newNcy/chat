"use client";

import * as React from "react";
import { MessageItem } from "@/components/chat/message";
import { ChatInput } from "@/components/chat/chat-input";
import { ModelSelector } from "@/components/chat/model-selector";
import { AiAvatar } from "@/components/chat/ai-avatar";
import { toast } from "@/components/ui/toaster";
import { useAppStore } from "@/lib/store/app-store";
import { readDataStream } from "@/lib/api/stream";
import { toApiMessages } from "@/lib/api/messages";
import { uid } from "@/lib/utils";
import type { ChatMessage, ImageAttachment, AIConfig } from "@/types";

interface ChatProps {
  onOpenSettings: () => void;
}

export function Chat({ onOpenSettings }: ChatProps) {
  const {
    hydrated,
    currentConfig,
    configs,
    preferences,
    currentConversation,
    newConversation,
    setConversationMessages,
  } = useAppStore();

  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  // 保存最新 messages 引用，供流式回调使用
  const messagesRef = React.useRef<ChatMessage[]>([]);

  const messages = React.useMemo(
    () => currentConversation?.messages ?? [],
    [currentConversation?.messages]
  );
  messagesRef.current = messages;

  const hasConfig = configs.length > 0 && !!currentConfig;

  // 自动滚动到底部
  const scrollToBottom = React.useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversation?.id]);

  React.useEffect(() => {
    if (streaming) scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  /** 执行一次生成：给定要发送的消息列表（不含待填充的 assistant） */
  const runGeneration = React.useCallback(
    async (
      conversationId: string,
      baseMessages: ChatMessage[],
      config: AIConfig
    ) => {
      const assistantId = uid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        pending: true,
      };

      let working = [...baseMessages, assistantMsg];
      setConversationMessages(conversationId, working);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = "";
      let errored = false;

      // 打字机式平滑显示：即使上游一次性返回也逐字渲染
      let displayed = "";
      let streamDone = false;
      let typingDone = false;
      let rafId: number | null = null;

      const flushDisplayed = () => {
        working = working.map((m) =>
          m.id === assistantId
            ? { ...m, content: displayed, pending: true }
            : m
        );
        setConversationMessages(conversationId, working);
      };

      /** 立即显示全部已接收内容（错误/停止时跳过动画） */
      const jumpToEnd = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        displayed = accumulated;
        typingDone = true;
        flushDisplayed();
      };

      const typeLoop = () => {
        const remaining = accumulated.length - displayed.length;
        if (remaining > 0) {
          // 剩余越多速度越快，收尾平滑（约 1 秒内追上）
          const step = Math.max(1, Math.ceil(remaining * 0.05));
          displayed = accumulated.slice(0, displayed.length + step);
          flushDisplayed();
        } else if (streamDone) {
          typingDone = true;
          rafId = null;
          return;
        }
        rafId = requestAnimationFrame(typeLoop);
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            baseURL: config.baseURL,
            apiKey: config.apiKey,
            model: config.model,
            messages: toApiMessages(baseMessages, preferences.systemPrompt),
          }),
        });

        if (!res.ok) {
          // 非流式错误响应（JSON）
          const data = await res.json().catch(() => null);
          const title = data?.error?.title ?? `请求失败 (${res.status})`;
          const message = data?.error?.message ?? "API 请求失败。";
          errored = true;
          working = working.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  pending: false,
                  error: `${title}\n\n${message}`,
                }
              : m
          );
          setConversationMessages(conversationId, working);
          return;
        }

        if (!res.body) {
          throw new Error("响应没有内容流");
        }

        await readDataStream(res.body, {
          onText: (delta) => {
            accumulated += delta;
            if (rafId === null) {
              rafId = requestAnimationFrame(typeLoop);
            }
          },
          onError: (msg) => {
            errored = true;
            // 立即显示全部已接收内容，跳过动画
            jumpToEnd();
            // 流内错误：若已有部分内容则追加错误，否则作为错误消息
            working = working.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: false,
                    content: accumulated,
                    error: accumulated ? undefined : msg,
                  }
                : m
            );
            if (accumulated) {
              toast({
                variant: "error",
                title: "生成中断",
                description: msg,
              });
            }
            setConversationMessages(conversationId, working);
          },
        });

        // 等待打字动画追上已接收内容
        streamDone = true;
        while (!typingDone) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          );
        }
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === "AbortError") {
          // 用户主动停止：立即显示全部已接收内容，不算错误
          jumpToEnd();
        } else {
          jumpToEnd();
          errored = true;
          const message =
            (err as { message?: string })?.message ??
            "无法连接到 API，请检查网络或配置。";
          working = working.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  pending: false,
                  content: accumulated,
                  error: accumulated ? undefined : `网络错误\n\n${message}`,
                }
              : m
          );
          setConversationMessages(conversationId, working);
        }
      } finally {
        // 收尾：清除 pending 标记
        if (!errored) {
          if (!typingDone) jumpToEnd();
          working = messagesRef.current.map((m) =>
            m.id === assistantId
              ? { ...m, content: displayed, pending: false }
              : m
          );
          setConversationMessages(conversationId, working);
        } else {
          working = messagesRef.current.map((m) =>
            m.id === assistantId ? { ...m, pending: false } : m
          );
          setConversationMessages(conversationId, working);
        }
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [setConversationMessages, preferences.systemPrompt]
  );

  const handleSend = React.useCallback(
    (text: string, images: ImageAttachment[]) => {
      if (!currentConfig) {
        toast({
          variant: "error",
          title: "未配置 API",
          description: "请先在设置中添加并选择一个 API 配置。",
        });
        return;
      }

      // 确保有会话
      let conversationId = currentConversation?.id;
      let baseMessages = messagesRef.current;
      if (!conversationId) {
        const conv = newConversation();
        conversationId = conv.id;
        baseMessages = [];
      }

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        images: images.length > 0 ? images : undefined,
        createdAt: Date.now(),
      };

      const nextBase = [...baseMessages, userMsg];
      void runGeneration(conversationId, nextBase, currentConfig);
    },
    [currentConfig, currentConversation?.id, newConversation, runGeneration]
  );

  const handleStop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRegenerate = React.useCallback(() => {
    if (!currentConfig || !currentConversation) return;
    const msgs = messagesRef.current;
    // 找到最后一条 assistant 消息并移除它，用其之前的消息重新生成
    let lastAssistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;
    const baseMessages = msgs.slice(0, lastAssistantIdx);
    if (baseMessages.length === 0) return;
    void runGeneration(currentConversation.id, baseMessages, currentConfig);
  }, [currentConfig, currentConversation, runGeneration]);

  // 最后一条 assistant 的索引（用于判断可否重新生成）
  const lastAssistantId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      {/* 消息区 */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <AiAvatar
              avatarId={preferences.aiAvatarId}
              customAvatar={preferences.customAvatar}
              className="h-14 w-14 rounded-xl"
            />
            <div>
              <h2 className="text-lg font-semibold">
                {hasConfig
                  ? `你好，我是 ${preferences.aiName}`
                  : "欢迎使用 AI Chat"}
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {hasConfig
                  ? `当前使用 ${currentConfig!.name} · ${currentConfig!.model}，输入消息开始聊天。`
                  : "在设置中添加任意 OpenAI-compatible API 的 URL、Token 和 Model，即可开始聊天。"}
              </p>
            </div>
            {!hasConfig && (
              <button
                onClick={onOpenSettings}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                添加 API 配置
              </button>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                streaming={streaming && msg.id === lastAssistantId}
                canRegenerate={
                  !streaming &&
                  msg.id === lastAssistantId &&
                  msg.role === "assistant"
                }
                onRegenerate={handleRegenerate}
              />
            ))}
            <div ref={bottomRef} className="h-4" />
          </div>
        )}
      </div>

      {/* 输入区 */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        streaming={streaming}
        disabled={!hydrated || !hasConfig}
        toolbar={<ModelSelector onOpenSettings={onOpenSettings} />}
      />
    </div>
  );
}
