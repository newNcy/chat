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
  const [showToken, setShowToken] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  // 已自动获取过的 URL+Token 组合（避免重复请求）
  const autoFetchedRef = React.useRef<string>("");

  const canSubmit = name.trim() && baseURL.trim() && apiKey.trim() && model.trim();

  /**
   * 获取模型列表
   * @param silent 静默模式（自动检测触发）：失败不弹提示，避免打断输入
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
        if (!silent) {
          toast({
            variant: "error",
            title: data?.error?.title ?? "获取模型失败",
            description:
              (data?.error?.message ?? "无法获取模型列表。") +
              "\n你仍可以手动输入 Model。",
          });
        }
        return;
      }
      const list: string[] = data.models ?? [];
      setModels(list);
      if (list.length > 0 && !model) setModel(list[0]);
      toast({
        variant: "success",
        title: silent ? "已自动获取模型" : "已获取模型",
        description: `成功获取 ${list.length} 个模型。`,
      });
    } catch {
      if (!silent) {
        toast({
          variant: "error",
          title: "获取模型失败",
          description: "网络错误，无法获取模型列表。你仍可以手动输入 Model。",
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshModels = () => void doFetchModels(false);

  // 自动检测：Base URL 与 API Token 均填写完成后，防抖自动获取模型列表
  React.useEffect(() => {
    const url = normalizeBaseURL(baseURL).trim();
    const key = apiKey.trim();
    if (!url || !key) return;

    const combo = `${url}\n${key}`;
    // 同一组合只自动获取一次
    if (autoFetchedRef.current === combo) return;

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
        description: "请先填写 Base URL、API Token 和 Model。",
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
        // 读取一小段流确认可用后立即中断
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
            <Label htmlFor="cfg-model">Model</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefreshModels}
              disabled={refreshing}
            >
              <RefreshCw
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh Models
            </Button>
          </div>
          <Input
            id="cfg-model"
            placeholder="例如：grok-4"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            list="cfg-model-list"
          />
          {models.length > 0 && (
            <datalist id="cfg-model-list">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          )}
          {models.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {models.slice(0, 12).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModel(m)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-accent ${
                    model === m ? "border-primary bg-accent" : ""
                  }`}
                >
                  {m}
                </button>
              ))}
              {models.length > 12 && (
                <span className="px-1 py-0.5 text-xs text-muted-foreground">
                  等 {models.length} 个
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
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
