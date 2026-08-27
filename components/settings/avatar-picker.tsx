"use client";

import * as React from "react";
import { Check, Loader2, Trash2, Upload } from "lucide-react";
import { AiAvatar, AVATAR_PRESETS, CUSTOM_AVATAR_ID } from "@/components/chat/ai-avatar";
import { cn } from "@/lib/utils";

/** 选中角标 */
export function SelectedBadge() {
  return (
    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check className="h-2.5 w-2.5" />
    </span>
  );
}

interface AvatarPickerProps {
  /** 当前选中的头像 id（预设 id 或 CUSTOM_AVATAR_ID） */
  avatarId: string;
  /** 自定义头像 data URL */
  customAvatar?: string;
  /** 网格首部的额外格子（如"我的头像"的默认样式格） */
  leadingSlot?: React.ReactNode;
  /** 上传处理中 */
  uploading?: boolean;
  onSelect: (id: string) => void;
  onUpload: (file: File) => void;
  onRemoveCustom: () => void;
}

/** 头像选择网格：预设 + 设备上传（AI 与"我的头像"共用同一组件，样式完全一致） */
export function AvatarPicker({
  avatarId,
  customAvatar,
  leadingSlot,
  uploading,
  onSelect,
  onUpload,
  onRemoveCustom,
}: AvatarPickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isCustom = avatarId === CUSTOM_AVATAR_ID;
  const hasCustom = Boolean(customAvatar);

  /** 上传格：无图/已选中 → 打开选择器；有图未选中 → 选中 */
  const handleCustomCellClick = () => {
    if (!hasCustom || isCustom) {
      inputRef.current?.click();
    } else {
      onSelect(CUSTOM_AVATAR_ID);
    }
  };

  const cellClass = (selected: boolean, dashed: boolean) =>
    cn(
      "relative flex aspect-square w-full items-center justify-center rounded-md border p-1 transition-colors hover:bg-accent disabled:opacity-60",
      selected
        ? "border-ring"
        : dashed
          ? "border-dashed"
          : "border-transparent"
    );

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {/* 首部额外格子 */}
      {leadingSlot}

      {/* 预设格子 */}
      {AVATAR_PRESETS.map((preset) => {
        const selected = preset.id === avatarId;
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            aria-label={`头像：${preset.label}`}
            onClick={() => onSelect(preset.id)}
            className={cellClass(selected, false)}
          >
            <AiAvatar avatarId={preset.id} className="h-9 w-9" />
            {selected && <SelectedBadge />}
          </button>
        );
      })}

      {/* 自定义上传格 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      <div className="relative">
        <button
          type="button"
          title={
            !hasCustom
              ? "从设备选择头像"
              : isCustom
                ? "更换自定义头像"
                : "使用自定义头像"
          }
          aria-label="自定义头像"
          disabled={uploading}
          onClick={handleCustomCellClick}
          className={cellClass(isCustom, true)}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : hasCustom && customAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customAvatar}
              alt="自定义头像"
              className="h-9 w-9 rounded object-cover"
            />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {isCustom && <SelectedBadge />}
        {hasCustom && (
          <button
            type="button"
            title="移除自定义头像"
            aria-label="移除自定义头像"
            onClick={onRemoveCustom}
            className="absolute -bottom-1.5 -right-1.5 rounded-full border bg-background p-0.5 shadow-sm hover:bg-accent"
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}
