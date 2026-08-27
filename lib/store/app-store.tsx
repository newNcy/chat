"use client";

import * as React from "react";
import type { AIConfig, AppPreferences, Conversation, ChatMessage } from "@/types";
import {
  loadConfigs,
  saveConfigs,
  loadCurrentConfigId,
  saveCurrentConfigId,
  loadConversations,
  saveConversations,
  loadPreferences,
  savePreferences,
  DEFAULT_PREFERENCES,
} from "@/lib/storage";
import { uid, deriveTitle } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface AppState {
  hydrated: boolean;

  // 偏好设置（对话外观）
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => void;

  // 配置
  configs: AIConfig[];
  currentConfigId: string | null;
  currentConfig: AIConfig | null;
  addConfig: (config: Omit<AIConfig, "id" | "createdAt">) => AIConfig;
  updateConfig: (id: string, patch: Partial<AIConfig>) => void;
  deleteConfig: (id: string) => void;
  duplicateConfig: (id: string) => void;
  setCurrentConfig: (id: string) => void;

  // 会话
  conversations: Conversation[];
  currentConversationId: string | null;
  currentConversation: Conversation | null;
  newConversation: () => Conversation;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setConversationMessages: (id: string, messages: ChatMessage[]) => void;
  updateConversationConfig: (id: string, configId: string) => void;
}

const AppStoreContext = React.createContext<AppState | null>(null);

export function useAppStore(): AppState {
  const ctx = React.useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore 必须在 AppStoreProvider 内使用");
  return ctx;
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = React.useState(false);
  const [preferences, setPreferences] =
    React.useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [configs, setConfigs] = React.useState<AIConfig[]>([]);
  const [currentConfigId, setCurrentConfigId] = React.useState<string | null>(
    null
  );
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = React.useState<
    string | null
  >(null);

  // 最新会话引用（供防抖持久化读取最新值）
  const conversationsRef = React.useRef<Conversation[]>([]);
  const persistTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // 防抖持久化：流式高频更新时避免每帧同步写盘阻塞渲染
  const schedulePersist = React.useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      const res = saveConversations(conversationsRef.current);
      if (!res.ok && res.quotaExceeded) {
        toast({
          variant: "error",
          title: "存储空间不足",
          description: "本地存储空间不足，聊天记录可能无法完整保存。",
        });
      }
    }, 400);
  }, []);

  // 初始化：从 localStorage 读取
  React.useEffect(() => {
    const loadedConfigs = loadConfigs();
    const loadedCurrent = loadCurrentConfigId();
    const loadedConversations = loadConversations();

    setPreferences(loadPreferences());
    setConfigs(loadedConfigs);
    setCurrentConfigId(
      loadedCurrent && loadedConfigs.some((c) => c.id === loadedCurrent)
        ? loadedCurrent
        : loadedConfigs[0]?.id ?? null
    );
    setConversations(loadedConversations);
    setCurrentConversationId(
      loadedConversations.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ??
        null
    );
    setHydrated(true);
  }, []);

  // 持久化：偏好设置
  const updatePreferences = React.useCallback(
    (patch: Partial<AppPreferences>) => {
      setPreferences((prev) => {
        const next = { ...prev, ...patch };
        const res = savePreferences(next);
        if (!res.ok) {
          toast({
            variant: "error",
            title: "保存失败",
            description: res.error ?? "无法保存偏好设置",
          });
        }
        return next;
      });
    },
    []
  );

  // 持久化：配置
  const persistConfigs = React.useCallback((next: AIConfig[]) => {
    setConfigs(next);
    const res = saveConfigs(next);
    if (!res.ok) {
      toast({
        variant: "error",
        title: "保存失败",
        description: res.error ?? "无法保存配置",
      });
    }
  }, []);

  const persistCurrentConfigId = React.useCallback((id: string | null) => {
    setCurrentConfigId(id);
    saveCurrentConfigId(id);
  }, []);

  // 持久化：会话
  const persistConversations = React.useCallback(
    (next: Conversation[]) => {
      setConversations(next);
      const res = saveConversations(next);
      if (!res.ok && res.quotaExceeded) {
        toast({
          variant: "error",
          title: "存储空间不足",
          description:
            res.error ?? "本地存储空间不足，部分聊天记录可能无法保存。",
        });
      } else if (!res.ok) {
        toast({
          variant: "error",
          title: "保存失败",
          description: res.error ?? "无法保存聊天记录",
        });
      } else if (res.quotaExceeded && res.error) {
        // 自动清理提示
        toast({ variant: "info", title: "提示", description: res.error });
      }
    },
    []
  );

  // ------- 配置操作 -------
  const addConfig = React.useCallback(
    (config: Omit<AIConfig, "id" | "createdAt">) => {
      const newConfig: AIConfig = {
        ...config,
        id: uid(),
        createdAt: Date.now(),
      };
      const next = [...configs, newConfig];
      persistConfigs(next);
      if (!currentConfigId) persistCurrentConfigId(newConfig.id);
      return newConfig;
    },
    [configs, currentConfigId, persistConfigs, persistCurrentConfigId]
  );

  const updateConfig = React.useCallback(
    (id: string, patch: Partial<AIConfig>) => {
      persistConfigs(
        configs.map((c) => (c.id === id ? { ...c, ...patch, id } : c))
      );
    },
    [configs, persistConfigs]
  );

  const deleteConfig = React.useCallback(
    (id: string) => {
      const next = configs.filter((c) => c.id !== id);
      persistConfigs(next);
      if (currentConfigId === id) {
        persistCurrentConfigId(next[0]?.id ?? null);
      }
    },
    [configs, currentConfigId, persistConfigs, persistCurrentConfigId]
  );

  const duplicateConfig = React.useCallback(
    (id: string) => {
      const src = configs.find((c) => c.id === id);
      if (!src) return;
      const copy: AIConfig = {
        ...src,
        id: uid(),
        name: `${src.name} 副本`,
        createdAt: Date.now(),
      };
      persistConfigs([...configs, copy]);
    },
    [configs, persistConfigs]
  );

  const setCurrentConfig = React.useCallback(
    (id: string) => {
      persistCurrentConfigId(id);
    },
    [persistCurrentConfigId]
  );

  // ------- 会话操作 -------
  const newConversation = React.useCallback(() => {
    const conv: Conversation = {
      id: uid(),
      title: "新对话",
      messages: [],
      configId: currentConfigId ?? undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [conv, ...conversations];
    persistConversations(next);
    setCurrentConversationId(conv.id);
    return conv;
  }, [conversations, currentConfigId, persistConversations]);

  const selectConversation = React.useCallback((id: string) => {
    setCurrentConversationId(id);
  }, []);

  const deleteConversation = React.useCallback(
    (id: string) => {
      const next = conversations.filter((c) => c.id !== id);
      persistConversations(next);
      if (currentConversationId === id) {
        setCurrentConversationId(
          next.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null
        );
      }
    },
    [conversations, currentConversationId, persistConversations]
  );

  const renameConversation = React.useCallback(
    (id: string, title: string) => {
      const clean = title.trim() || "新对话";
      persistConversations(
        conversations.map((c) =>
          c.id === id ? { ...c, title: clean, updatedAt: Date.now() } : c
        )
      );
    },
    [conversations, persistConversations]
  );

  const setConversationMessages = React.useCallback(
    (id: string, messages: ChatMessage[]) => {
      // 纯状态更新（不在 updater 中做副作用，保证流式渲染流畅）
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          // 若仍是默认标题且已有用户消息，自动生成标题
          let title = c.title;
          if ((title === "新对话" || !title) && messages.length > 0) {
            const firstUser = messages.find((m) => m.role === "user");
            if (firstUser) title = deriveTitle(firstUser.content);
          }
          return { ...c, messages, title, updatedAt: Date.now() };
        })
      );
      // 防抖持久化到 localStorage（流式期间只写最后一次）
      schedulePersist();
    },
    [schedulePersist]
  );

  const updateConversationConfig = React.useCallback(
    (id: string, configId: string) => {
      persistConversations(
        conversations.map((c) =>
          c.id === id ? { ...c, configId, updatedAt: Date.now() } : c
        )
      );
    },
    [conversations, persistConversations]
  );

  const currentConfig =
    configs.find((c) => c.id === currentConfigId) ?? null;
  const currentConversation =
    conversations.find((c) => c.id === currentConversationId) ?? null;

  const value = React.useMemo<AppState>(
    () => ({
      hydrated,
      preferences,
      updatePreferences,
      configs,
      currentConfigId,
      currentConfig,
      addConfig,
      updateConfig,
      deleteConfig,
      duplicateConfig,
      setCurrentConfig,
      conversations,
      currentConversationId,
      currentConversation,
      newConversation,
      selectConversation,
      deleteConversation,
      renameConversation,
      setConversationMessages,
      updateConversationConfig,
    }),
    [
      hydrated,
      preferences,
      updatePreferences,
      configs,
      currentConfigId,
      currentConfig,
      addConfig,
      updateConfig,
      deleteConfig,
      duplicateConfig,
      setCurrentConfig,
      conversations,
      currentConversationId,
      currentConversation,
      newConversation,
      selectConversation,
      deleteConversation,
      renameConversation,
      setConversationMessages,
      updateConversationConfig,
    ]
  );

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}
