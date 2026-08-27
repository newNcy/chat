"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ApiConfigList } from "@/components/settings/api-config-list";
import { ApiConfigForm } from "@/components/settings/api-config-form";
import { useAppStore } from "@/lib/store/app-store";
import type { AIConfig } from "@/types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type View =
  | { mode: "list" }
  | { mode: "add" }
  | { mode: "edit"; config: AIConfig };

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { addConfig, updateConfig } = useAppStore();
  const [view, setView] = React.useState<View>({ mode: "list" });

  // 每次打开时重置到列表视图
  React.useEffect(() => {
    if (open) setView({ mode: "list" });
  }, [open]);

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onClose={close}>
        {view.mode === "list" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">设置</h2>
              <p className="text-sm text-muted-foreground">
                管理 API 配置。Token 仅保存在本地浏览器，绝不会上传服务器。
              </p>
            </div>

            <ApiConfigList
              onAdd={() => setView({ mode: "add" })}
              onEdit={(config) => setView({ mode: "edit", config })}
            />
          </>
        )}

        {view.mode === "add" && (
          <ApiConfigForm
            onCancel={() => setView({ mode: "list" })}
            onSubmit={(data) => {
              addConfig(data);
              setView({ mode: "list" });
            }}
          />
        )}

        {view.mode === "edit" && (
          <ApiConfigForm
            initial={view.config}
            onCancel={() => setView({ mode: "list" })}
            onSubmit={(data) => {
              updateConfig(view.config.id, data);
              setView({ mode: "list" });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
