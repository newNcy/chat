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
import {
  delay,
  GENERATION_MAX_RETRIES,
  isRetryableGenerationError,
} from "@/lib/api/retry";
import { uid } from "@/lib/utils";
import type { ChatMessage, ImageAttachment, AIConfig, MessageVariant } from "@/types";

interface ChatProps {
  onOpenSettings: () => void;
}

function getValidVariants(msg: ChatMessage): MessageVariant[] {
  return (msg.variants ?? []).filter((v) => v.content.trim().length > 0);
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
  // 逐字动画进行中（流式可能已结束，但打字动画仍在追）
  const [typingActive, setTypingActive] = React.useState(false);
  // 冻结逐字动画令牌
  const [freezeAnimToken, setFreezeAnimToken] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const variantScrollPendingRef = React.useRef<{
    messageId: string;
    pinBottom: boolean;
  } | null>(null);
  // 保存最新 messages 引用，供流式回调使用
  const messagesRef = React.useRef<ChatMessage[]>([]);

  const messages = React.useMemo(
    () => currentConversation?.messages ?? [],
    [currentConversation?.messages]
  );
  messagesRef.current = messages;

  const hasConfig = configs.length > 0 && !!currentConfig;

  const isNearBottom = React.useCallback((threshold = 80) => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const pinScrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // 自动滚动到底部
  const scrollToBottom = React.useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  React.useLayoutEffect(() => {
    const pending = variantScrollPendingRef.current;
    if (!pending) return;
    variantScrollPendingRef.current = null;

    if (pending.pinBottom) {
      pinScrollToBottom();
    }

    const msgEl = document.querySelector(
      `[data-message-id="${pending.messageId}"]`
    ) as HTMLElement | null;
    if (msgEl) msgEl.style.minHeight = "";
  }, [messages, pinScrollToBottom]);

  React.useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversation?.id]);

  React.useEffect(() => {
    if (streaming) scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  // 软键盘弹出导致布局高度变化时，把对话滚回底部
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const isInputFocused = () => {
      const t = document.activeElement as HTMLElement | null;
      return !!(
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      );
    };

    const settleToBottom = () => {
      if (!isInputFocused() && !isNearBottom(120)) return;
      pinScrollToBottom();
      requestAnimationFrame(() => {
        pinScrollToBottom();
        // 键盘动画过程中高度会连续变化，再补一次
        setTimeout(pinScrollToBottom, 120);
        setTimeout(pinScrollToBottom, 280);
      });
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        settleToBottom();
      }
    };

    vv.addEventListener("resize", settleToBottom);
    vv.addEventListener("scroll", settleToBottom);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("app-keyboard-viewport", settleToBottom);

    return () => {
      vv.removeEventListener("resize", settleToBottom);
      vv.removeEventListener("scroll", settleToBottom);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("app-keyboard-viewport", settleToBottom);
    };
  }, [pinScrollToBottom, isNearBottom]);

  // 流式逐字显现时内容高度在子组件内变化，需监听尺寸
  React.useEffect(() => {
    if (!streaming) return;
    const container = scrollRef.current;
    const content = container?.firstElementChild as HTMLElement | undefined;
    if (!content) return;

    const pin = () => pinScrollToBottom();
    const observer = new ResizeObserver(pin);
    observer.observe(content);
    pin();

    return () => observer.disconnect();
  }, [streaming, pinScrollToBottom]);

  /** 执行一次生成：给定要发送的消息列表（不含待填充的 assistant） */
  const runGeneration = React.useCallback(
    async (
      conversationId: string,
      baseMessages: ChatMessage[],
      config: AIConfig,
      regenerateAssistantId?: string
    ) => {
      let assistantId: string;
      let working: ChatMessage[];
      let apiBaseMessages: ChatMessage[];
      let regenerateSnapshot: {
        variants?: MessageVariant[];
        activeVariantIndex?: number;
        content: string;
        error?: string;
      } | null = null;

      if (regenerateAssistantId) {
        assistantId = regenerateAssistantId;
        const existingIdx = baseMessages.findIndex(
          (m) => m.id === regenerateAssistantId
        );
        if (existingIdx === -1) return;
        const existingMsg = baseMessages[existingIdx];
        apiBaseMessages = baseMessages.slice(0, existingIdx);

        let variants = [...(existingMsg.variants ?? [])];
        const activeIdx =
          existingMsg.activeVariantIndex ??
          Math.max(0, variants.length - 1);

        if (variants.length === 0) {
          variants.push({
            content: existingMsg.content,
            error: existingMsg.error,
            createdAt: existingMsg.createdAt,
          });
        } else {
          variants[activeIdx] = {
            ...variants[activeIdx],
            content: existingMsg.content,
            error: existingMsg.error,
          };
        }

        regenerateSnapshot = {
          variants: getValidVariants({ ...existingMsg, variants }),
          activeVariantIndex: activeIdx,
          content: existingMsg.content,
          error: existingMsg.error,
        };

        const updatedAssistant: ChatMessage = {
          ...existingMsg,
          variants: regenerateSnapshot.variants,
          activeVariantIndex: activeIdx,
          content: "",
          error: undefined,
          pending: true,
        };

        working = [...apiBaseMessages, updatedAssistant];
      } else {
        assistantId = uid();
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          pending: true,
        };
        apiBaseMessages = baseMessages;
        working = [...baseMessages, assistantMsg];
      }

      setConversationMessages(conversationId, working);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const syncAssistant = (patch: Partial<ChatMessage>) => {
        working = working.map((m) =>
          m.id === assistantId ? { ...m, ...patch } : m
        );
        setConversationMessages(conversationId, working);
      };

      const commitRegenerateVariant = (content: string) => {
        const msg = working.find((m) => m.id === assistantId);
        if (!msg) return;
        const variants = [
          ...getValidVariants(msg),
          { content, createdAt: Date.now() },
        ];
        syncAssistant({
          variants,
          activeVariantIndex: variants.length - 1,
          content,
          error: undefined,
          pending: false,
        });
      };

      const rollbackRegenerate = () => {
        if (!regenerateSnapshot) return;
        syncAssistant({
          variants: regenerateSnapshot.variants,
          activeVariantIndex: regenerateSnapshot.activeVariantIndex,
          content: regenerateSnapshot.content,
          error: regenerateSnapshot.error,
          pending: false,
        });
      };

      let succeeded = false;
      let lastError = "";
      let aborted = false;

      for (let attempt = 0; attempt <= GENERATION_MAX_RETRIES; attempt++) {
        if (controller.signal.aborted) {
          aborted = true;
          break;
        }

        if (attempt > 0) {
          toast({
            variant: "info",
            title: "正在重试",
            description: `请求失败，正在进行第 ${attempt + 1} 次尝试…`,
          });
          try {
            await delay(600 * attempt, controller.signal);
          } catch {
            aborted = true;
            break;
          }
          syncAssistant({ content: "", error: undefined, pending: true });
        }

        let accumulated = "";
        let attemptErrored = false;
        let attemptErrorMsg = "";
        let attemptStatus: number | undefined;

        const flushContent = (pending = true) => {
          syncAssistant({ content: accumulated, pending });
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
              messages: toApiMessages(
                apiBaseMessages,
                preferences.systemPrompt
              ),
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            attemptStatus = res.status;
            const title = data?.error?.title ?? `请求失败 (${res.status})`;
            const message = data?.error?.message ?? "API 请求失败。";
            attemptErrored = true;
            attemptErrorMsg = `${title}\n\n${message}`;
          } else if (!res.body) {
            attemptErrored = true;
            attemptErrorMsg = "响应没有内容流";
          } else {
            await readDataStream(res.body, {
              onText: (delta) => {
                accumulated += delta;
                flushContent(true);
              },
              onError: (msg) => {
                attemptErrored = true;
                attemptErrorMsg = msg;
                flushContent(false);
              },
            });
          }
        } catch (err) {
          const name = (err as { name?: string })?.name;
          if (name === "AbortError") {
            aborted = true;
            flushContent(false);
            break;
          }
          attemptErrored = true;
          attemptErrorMsg =
            (err as { message?: string })?.message ??
            "无法连接到 API，请检查网络或配置。";
          flushContent(false);
        }

        if (aborted) break;

        if (!attemptErrored && accumulated.trim()) {
          succeeded = true;
          if (regenerateSnapshot) {
            commitRegenerateVariant(accumulated);
          } else {
            syncAssistant({
              content: accumulated,
              pending: false,
              error: undefined,
            });
          }
          break;
        }

        lastError =
          attemptErrorMsg ||
          (accumulated.trim()
            ? "生成中断"
            : "请求失败，未收到有效回复。");

        const canRetry =
          attempt < GENERATION_MAX_RETRIES &&
          isRetryableGenerationError(attemptStatus, lastError);

        if (!canRetry) {
          if (regenerateSnapshot) {
            rollbackRegenerate();
            toast({
              variant: "error",
              title: "重新生成失败",
              description: lastError.split("\n")[0],
            });
          } else {
            syncAssistant({
              pending: false,
              content: accumulated || "",
              error: accumulated ? undefined : lastError,
            });
            if (accumulated) {
              toast({
                variant: "error",
                title: "生成中断",
                description: lastError.split("\n")[0],
              });
            }
          }
          break;
        }
      }

      if (aborted) {
        const msg = working.find((m) => m.id === assistantId);
        const partial = msg?.content?.trim() ?? "";
        if (regenerateSnapshot) {
          if (partial) {
            commitRegenerateVariant(partial);
          } else {
            rollbackRegenerate();
          }
        } else {
          syncAssistant({ pending: false });
        }
      } else if (!succeeded) {
        syncAssistant({ pending: false });
      }

      setStreaming(false);
      abortRef.current = null;
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
    // 网络流进行中：中断请求（已接收内容保留）
    if (streaming) {
      abortRef.current?.abort();
    }
    // 无论流是否结束，冻结逐字显示（停在当前已显示部分）
    setFreezeAnimToken((t) => t + 1);
  }, [streaming]);

  const handleRegenerate = React.useCallback(() => {
    if (!currentConfig || !currentConversation) return;
    const msgs = messagesRef.current;
    let lastAssistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;
    const assistantMsg = msgs[lastAssistantIdx];
    if (lastAssistantIdx === 0) return;
    void runGeneration(
      currentConversation.id,
      msgs.slice(0, lastAssistantIdx + 1),
      currentConfig,
      assistantMsg.id
    );
  }, [currentConfig, currentConversation, runGeneration]);

  const handleSwitchVariant = React.useCallback(
    (messageId: string, direction: "prev" | "next") => {
      if (!currentConversation || streaming) return;
      const msgs = messagesRef.current;
      const idx = msgs.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const msg = msgs[idx];
      const validVariants = getValidVariants(msg);
      if (validVariants.length <= 1) return;

      const byIndex =
        typeof msg.activeVariantIndex === "number" &&
        msg.activeVariantIndex >= 0 &&
        msg.activeVariantIndex < validVariants.length
          ? msg.activeVariantIndex
          : -1;
      const byContent = validVariants.findIndex((v) => v.content === msg.content);
      const current =
        byIndex >= 0 ? byIndex : byContent >= 0 ? byContent : validVariants.length - 1;
      const next =
        direction === "prev"
          ? Math.max(0, current - 1)
          : Math.min(validVariants.length - 1, current + 1);
      if (next === current) return;

      const variant = validVariants[next];
      const pinBottom = isNearBottom();
      const msgEl = document.querySelector(
        `[data-message-id="${messageId}"]`
      ) as HTMLElement | null;
      if (pinBottom && msgEl) {
        msgEl.style.minHeight = `${msgEl.offsetHeight}px`;
      }

      const updated = msgs.map((m, i) =>
        i === idx
          ? {
              ...m,
              variants: validVariants,
              activeVariantIndex: next,
              content: variant.content,
              error: variant.error,
            }
          : m
      );
      variantScrollPendingRef.current = { messageId, pinBottom };
      setConversationMessages(currentConversation.id, updated);
    },
    [currentConversation, streaming, setConversationMessages, isNearBottom]
  );

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
            {messages.map((msg) => {
              const validVariants = getValidVariants(msg);
              const hasVariants = validVariants.length > 1;
              const byIndex =
                typeof msg.activeVariantIndex === "number" &&
                msg.activeVariantIndex >= 0 &&
                msg.activeVariantIndex < validVariants.length
                  ? msg.activeVariantIndex
                  : -1;
              const byContent = hasVariants
                ? validVariants.findIndex((v) => v.content === msg.content)
                : -1;
              const displayVariantIndex =
                (byIndex >= 0 ? byIndex : byContent >= 0 ? byContent : validVariants.length - 1) +
                1;

              return (
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
                variantIndex={hasVariants ? displayVariantIndex : undefined}
                variantCount={hasVariants ? validVariants.length : undefined}
                onPrevVariant={
                  hasVariants
                    ? () => handleSwitchVariant(msg.id, "prev")
                    : undefined
                }
                onNextVariant={
                  hasVariants
                    ? () => handleSwitchVariant(msg.id, "next")
                    : undefined
                }
                onStreamScroll={
                  msg.id === lastAssistantId ? pinScrollToBottom : undefined
                }
                skipAnimToken={
                  msg.id === lastAssistantId ? freezeAnimToken : undefined
                }
                onTypingStateChange={
                  msg.id === lastAssistantId ? setTypingActive : undefined
                }
              />
            );
            })}
            <div
              ref={bottomRef}
              className="h-4 [overflow-anchor:auto]"
            />
          </div>
        )}
      </div>

      {/* 输入区：流式或逐字动画进行中均显示停止按钮 */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        streaming={streaming || typingActive}
        disabled={!hydrated || !hasConfig}
        toolbar={<ModelSelector onOpenSettings={onOpenSettings} />}
      />
    </div>
  );
}
