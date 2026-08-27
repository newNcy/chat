"use client";

import * as React from "react";
import { Eye, EyeOff, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { ModelLabel } from "@/components/models/model-label";
import { normalizeBaseURL } from "@/lib/utils";
import type { AIConfig } from "@/types";

interface ApiConfigFormProps {
  /** 编辑时传入现有配置 */
  initial?: AIConfig | null;
  onSubmit: (data: {
    name: string;
    baseURL: string;
    apiKey: string;
    model: string;
    models?: string[];
  }) => void;
  onCancel: () => void;
}

type FetchState = "idle" | "loading" | "done";

export function ApiConfigForm({
  initial,
  onSubmit,
  onCancel,
}: ApiConfigFormProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [baseURL, setBaseURL] = React.useState(initial?.baseURL ?? "");
  const [apiKey, setApiKey] = React.useState(initial?.apiKey ?? "");
  const [model, setModel] = React.useState(initial?.model ?? "");
  const [models, setModels] = React.useState<string[]>(initial?.models ?? []);
  const [fetchState, setFetchState] = React.useState<FetchState>(
    initial?.models?.length ? "done" : "idle"
  );
  const [showToken, setShowToken] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const autoFetchedRef = React.useRef<string>(
    initial?.baseURL && initial?.apiKey
      ? `${normalizeBaseURL(initial.baseURL)}\n${initial.apiKey.trim()}`
      : ""
  );

  const canSubmit =
    name.trim() &&
    baseURL.trim() &&
    apiKey.trim() &&
    models.length > 0 &&
    model.trim();

  const applyModelList = (list: string[]) => {
    setModels(list);
    setModel(list[0] ?? "");
    setFetchState("done");
  };

  /**
   * 获取模型列表
   * @param silent 静默模式（自动检测触发）：失败不弹提示
   */
  const doFetchModels = async (silent: boolean) => {
    if (!baseURL.trim() || !apiKey.trim()) {
      if (!silent) {
        toast({
          variant: "error",
          title: "无法获取模型",
          description: "请先填写 Base URL 和 API Token。",
        });
      }
      return;
    }
    setRefreshing(true);
    setFetchState("loading");
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseURL: normalizeBaseURL(baseURL),
          apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModels([]);
        setModel("");
        setFetchState("done");
        if (!silent) {
          toast({
            variant: "error",
            title: data?.error?.title ?? "获取模型失败",
            description: data?.error?.message ?? "无法获取模型列表。",
          });
        }
        return;
      }
      const list: string[] = data.models ?? [];
      applyModelList(list);
      if (!silent) {
        toast({
          variant: "success",
          title: "已获取模型",
          description:
            list.length > 0
              ? `成功获取 ${list.length} 个模型。`
              : "该 API 未返回可用模型。",
        });
      }
    } catch {
      setModels([]);
      setModel("");
      setFetchState("done");
      if (!silent) {
        toast({
          variant: "error",
          title: "获取模型失败",
          description: "网络错误，无法获取模型列表。",
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshModels = () => {
    autoFetchedRef.current = "";
    void doFetchModels(false);
  };

  // Base URL 与 Token 填写完成后自动探测模型
  React.useEffect(() => {
    const url = normalizeBaseURL(baseURL).trim();
    const key = apiKey.trim();
    if (!url || !key) {
      setModels([]);
      setModel("");
      setFetchState("idle");
      autoFetchedRef.current = "";
      return;
    }

    const combo = `${url}\n${key}`;
    if (autoFetchedRef.current === combo) return;

    setModels([]);
    setModel("");
    setFetchState("loading");

    const timer = setTimeout(() => {
      autoFetchedRef.current = combo;
      void doFetchModels(true);
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseURL, apiKey]);

  const handleTestConnection = async () => {
    if (!baseURL.trim() || !apiKey.trim() || !model.trim()) {
      toast({
        variant: "error",
        title: "无法测试",
        description: "请先填写 Base URL、API Token，并确保已获取到可用模型。",
      });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseURL: normalizeBaseURL(baseURL),
          apiKey,
          model,
          messages: [{ role: "user", content: "ping" }],
        }),
      });

      if (res.ok) {
        try {
          await res.body?.getReader().cancel();
        } catch {
          // 忽略
        }
        toast({
          variant: "success",
          title: "连接成功",
          description: "API 可正常访问。",
        });
      } else {
        const data = await res.json().catch(() => null);
        toast({
          variant: "error",
          title: data?.error?.title ?? `连接失败 (${res.status})`,
          description: data?.error?.message ?? "无法连接到该 API。",
        });
      }
    } catch {
      toast({
        variant: "error",
        title: "连接失败",
        description: "网络错误，无法连接到该 API。",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      baseURL: normalizeBaseURL(baseURL),
      apiKey: apiKey.trim(),
      model: model.trim(),
      models,
    });
  };

  const modelStatusText = (() => {
    if (!baseURL.trim() || !apiKey.trim()) {
      return "填写 Base URL 和 Token 后自动获取";
    }
    if (fetchState === "loading" || refreshing) {
      return "正在获取模型…";
    }
    if (models.length === 0) {
      return "无可用";
    }
    return null;
  })();

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initial ? "编辑 API 配置" : "添加 API 配置"}</DialogTitle>
        <DialogDescription>
          填写任意 OpenAI-compatible API 的信息。所有数据仅保存在你的浏览器本地。
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cfg-name">名称</Label>
          <Input
            id="cfg-name"
            placeholder="例如：Grok"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cfg-base">Base URL</Label>
          <Input
            id="cfg-base"
            placeholder="https://api.example.com/v1"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            通常以 <code className="text-[0.8em]">/v1</code> 结尾。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cfg-token">API Token</Label>
          <div className="relative">
            <Input
              id="cfg-token"
              type={showToken ? "text" : "password"}
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showToken ? "隐藏 Token" : "显示 Token"}
            >
              {showToken ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>可用模型</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefreshModels}
              disabled={refreshing || !baseURL.trim() || !apiKey.trim()}
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              刷新
            </Button>
          </div>

          {modelStatusText ? (
            <p className="text-sm text-muted-foreground">{modelStatusText}</p>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/30 p-2">
              <div className="flex flex-wrap gap-1.5">
                {models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent ${
                      model === m
                        ? "border-primary bg-accent font-medium"
                        : "border-border"
                    }`}
                  >
                    <ModelLabel model={m} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !model}
          >
            <Wifi className={testing ? "animate-pulse" : ""} />
            Test Connection
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {initial ? "保存" : "添加"}
        </Button>
      </DialogFooter>
    </form>
  );
}
