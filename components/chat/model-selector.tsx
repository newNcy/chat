"use client";

import * as React from "react";
import { Boxes, Check, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ModelIcon } from "@/components/models/model-icon";
import { ModelLabel } from "@/components/models/model-label";
import { useAppStore } from "@/lib/store/app-store";

interface ModelSelectorProps {
  onOpenSettings: () => void;
}

/** 输入框底部左侧的紧凑配置/模型切换（收纳式） */
export function ModelSelector({ onOpenSettings }: ModelSelectorProps) {
  const { configs, currentConfig, setCurrentConfig, updateConfig } =
    useAppStore();

  // 无配置：显示添加入口
  if (configs.length === 0) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onOpenSettings}
        aria-label="添加 API 配置"
        title="添加 API 配置"
      >
        <Plus />
      </Button>
    );
  }

  const models = currentConfig?.models ?? [];

  return (
    <Dropdown
      contentClassName="max-h-80 overflow-y-auto scrollbar-thin"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label="选择模型"
          title={`${currentConfig?.name ?? ""} · ${currentConfig?.model ?? ""}`}
        >
          {currentConfig?.model ? (
            <ModelIcon model={currentConfig.model} size="md" />
          ) : (
            <Boxes />
          )}
        </Button>
      }
    >
      {(close) => (
        <>
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            API 配置
          </p>
          {configs.map((c) => (
              <DropdownItem
                key={c.id}
                onClick={() => {
                  setCurrentConfig(c.id);
                  close();
                }}
              >
                {c.id === currentConfig?.id ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span className="max-w-[200px] truncate">{c.name}</span>
              </DropdownItem>
            ))}
          <div className="my-1 border-t" />
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            模型
          </p>
          {models.length > 0 ? (
            models.map((m) => (
                <DropdownItem
                  key={m}
                  onClick={() => {
                    if (currentConfig) {
                      updateConfig(currentConfig.id, { model: m });
                    }
                    close();
                  }}
                >
                  {m === currentConfig?.model ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <span className="max-w-[220px]">
                    <ModelLabel model={m} truncate />
                  </span>
                </DropdownItem>
              ))
          ) : (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              暂无可用模型，请在设置中刷新
            </p>
          )}
          <div className="my-1 border-t" />
          <DropdownItem
            onClick={() => {
              onOpenSettings();
              close();
            }}
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            管理配置
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
