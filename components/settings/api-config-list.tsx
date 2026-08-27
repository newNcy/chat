"use client";

import * as React from "react";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAppStore } from "@/lib/store/app-store";
import type { AIConfig } from "@/types";

interface ApiConfigListProps {
  onAdd: () => void;
  onEdit: (config: AIConfig) => void;
}

export function ApiConfigList({ onAdd, onEdit }: ApiConfigListProps) {
  const {
    configs,
    currentConfigId,
    setCurrentConfig,
    deleteConfig,
    duplicateConfig,
  } = useAppStore();

  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">API 配置</h3>
        <Button size="sm" onClick={onAdd}>
          <Plus />
          Add API
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            还没有任何 API 配置。
          </p>
          <Button size="sm" className="mt-3" onClick={onAdd}>
            <Plus />
            添加第一个 API
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {configs.map((config) => {
            const active = config.id === currentConfigId;
            return (
              <div
                key={config.id}
                className={`flex flex-col rounded-lg border p-3 transition-colors ${
                  active ? "border-primary ring-1 ring-primary/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{config.name}</p>
                      {active && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          当前
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 truncate text-xs text-muted-foreground"
                      title={config.baseURL}
                    >
                      {config.baseURL}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {config.model}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    disabled={active}
                    onClick={() => setCurrentConfig(config.id)}
                  >
                    {active ? <Check /> : null}
                    {active ? "使用中" : "Use"}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onEdit(config)}
                    aria-label="编辑"
                    title="编辑"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => duplicateConfig(config.id)}
                    aria-label="复制"
                    title="复制"
                  >
                    <Copy />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setConfirmDeleteId(config.id)}
                    aria-label="删除"
                    title="删除"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="删除配置"
        description="确定要删除该 API 配置吗？此操作无法撤销。"
        confirmText="删除"
        destructive
        onConfirm={() => {
          if (confirmDeleteId) deleteConfig(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}
