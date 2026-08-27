"use client";

import * as React from "react";
import { Check, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AiAvatar,
  UserAvatar,
  AVATAR_PRESETS,
  CUSTOM_AVATAR_ID,
  DEFAULT_USER_AVATAR_ID,
} from "@/components/chat/ai-avatar";
import { useAppStore } from "@/lib/store/app-store";
import { toast } from "@/components/ui/toaster";
import { fileToCompressedDataUrl } from "@/lib/utils/image";
import { cn } from "@/lib/utils";

interface AssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 源文件大小上限（压缩前） */
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

function toastError(title: string, description: string) {
  toast({ variant: "error", title, description });
}

/** 选中角标 */
function SelectedBadge() {
  return (
    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check className="h-2.5 w-2.5" />
    </span>
  );
}

/** 对话设置：自定义 AI 与我的形象、聊天背景、预制 Prompt */
export function AssistantDialog({ open, onOpenChange }: AssistantDialogProps) {
  const { preferences, updatePreferences } = useAppStore();

  // 名称与 Prompt 为本地编辑态，关闭时统一提交；头像/背景即时生效
  const [name, setName] = React.useState(preferences.aiName);
  const [prompt, setPrompt] = React.useState(preferences.systemPrompt);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const [userAvatarUploading, setUserAvatarUploading] = React.useState(false);
  const [bgUploading, setBgUploading] = React.useState(false);

  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const userAvatarInputRef = React.useRef<HTMLInputElement>(null);
  const bgInputRef = React.useRef<HTMLInputElement>(null);

  // 每次打开时同步最新值
  React.useEffect(() => {
    if (open) {
      setName(preferences.aiName);
      setPrompt(preferences.systemPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = () => {
    updatePreferences({
      aiName: name.trim() || "AI",
      systemPrompt: prompt,
    });
  };

  const closeWithCommit = () => {
    commit();
    onOpenChange(false);
  };

  // ---------- 头像上传（AI / 用户通用） ----------

  const uploadAvatarImage = async (
    file: File | undefined,
    isUserAvatar: boolean
  ) => {
    if (!file) return;
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      toastError("图片过大", "请选择 15MB 以内的图片文件。");
      return;
    }
    if (isUserAvatar) setUserAvatarUploading(true);
    else setAvatarUploading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, { maxSize: 256 });
      if (isUserAvatar) {
        updatePreferences({
          userAvatarId: CUSTOM_AVATAR_ID,
          userCustomAvatar: dataUrl,
        });
      } else {
        updatePreferences({
          aiAvatarId: CUSTOM_AVATAR_ID,
          customAvatar: dataUrl,
        });
      }
    } catch (e) {
      toastError(
        "头像上传失败",
        e instanceof Error ? e.message : "无法处理该图片。"
      );
    } finally {
      setAvatarUploading(false);
      setUserAvatarUploading(false);
    }
  };

  // ---------- AI 头像 ----------

  const isCustomSelected = preferences.aiAvatarId === CUSTOM_AVATAR_ID;
  const hasCustomAvatar = Boolean(preferences.customAvatar);

  /** 自定义格：无图/已选中 → 打开选择器；有图未选中 → 选中 */
  const handleCustomCellClick = () => {
    if (!hasCustomAvatar || isCustomSelected) {
      avatarInputRef.current?.click();
    } else {
      updatePreferences({ aiAvatarId: CUSTOM_AVATAR_ID });
    }
  };

  const removeCustomAvatar = () => {
    updatePreferences({
      aiAvatarId: AVATAR_PRESETS[0].id,
      customAvatar: "",
    });
  };

  // ---------- 我的头像 ----------

  const isUserCustomSelected = preferences.userAvatarId === CUSTOM_AVATAR_ID;
  const hasUserCustomAvatar = Boolean(preferences.userCustomAvatar);
  const currentUserAvatarId =
    preferences.userAvatarId ?? DEFAULT_USER_AVATAR_ID;

  const handleUserCustomCellClick = () => {
    if (!hasUserCustomAvatar || isUserCustomSelected) {
      userAvatarInputRef.current?.click();
    } else {
      updatePreferences({ userAvatarId: CUSTOM_AVATAR_ID });
    }
  };

  const removeUserCustomAvatar = () => {
    updatePreferences({
      userAvatarId: DEFAULT_USER_AVATAR_ID,
      userCustomAvatar: "",
    });
  };

  // ---------- 聊天背景 ----------

  const hasBackground = Boolean(preferences.chatBackground);
  const bgOpacity = preferences.chatBackgroundOpacity ?? 20;

  const handleBgFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      toastError("图片过大", "请选择 15MB 以内的图片文件。");
      return;
    }
    setBgUploading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, {
        maxSize: 1920,
        quality: 0.8,
        mimeType: "image/jpeg",
      });
      updatePreferences({ chatBackground: dataUrl });
    } catch (e) {
      toastError(
        "背景上传失败",
        e instanceof Error ? e.message : "无法处理该图片。"
      );
    } finally {
      setBgUploading(false);
    }
  };

  const removeBackground = () => {
    updatePreferences({ chatBackground: "" });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) onOpenChange(true);
        else closeWithCommit();
      }}
    >
      <DialogContent className="max-w-lg" onClose={closeWithCommit}>
        <DialogHeader>
          <DialogTitle>对话设置</DialogTitle>
          <DialogDescription>
            自定义 AI 与你的形象、聊天背景与预制 Prompt，对所有对话生效。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* AI 名称 */}
          <div className="space-y-2">
            <Label htmlFor="ai-name">AI 名称</Label>
            <Input
              id="ai-name"
              value={name}
              placeholder="AI"
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* AI 头像：预设 + 从设备上传 */}
          <div className="space-y-2">
            <Label>AI 头像</Label>
            <div className="grid grid-cols-9 gap-1.5">
              {AVATAR_PRESETS.map((preset) => {
                const selected = preset.id === preferences.aiAvatarId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    aria-label={`头像：${preset.label}`}
                    onClick={() => updatePreferences({ aiAvatarId: preset.id })}
                    className={cn(
                      "relative flex aspect-square w-full items-center justify-center rounded-md border p-1 transition-colors hover:bg-accent",
                      selected ? "border-ring" : "border-transparent"
                    )}
                  >
                    <AiAvatar avatarId={preset.id} className="h-8 w-8" />
                    {selected && <SelectedBadge />}
                  </button>
                );
              })}

              {/* AI 自定义头像格 */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void uploadAvatarImage(e.target.files?.[0], false);
                  e.target.value = "";
                }}
              />
              <div className="relative">
                <button
                  type="button"
                  title={
                    !hasCustomAvatar
                      ? "从设备选择头像"
                      : isCustomSelected
                        ? "更换自定义头像"
                        : "使用自定义头像"
                  }
                  aria-label="自定义头像"
                  disabled={avatarUploading}
                  onClick={handleCustomCellClick}
                  className={cn(
                    "flex aspect-square w-full items-center justify-center rounded-md border p-1 transition-colors hover:bg-accent disabled:opacity-60",
                    isCustomSelected ? "border-ring" : "border-dashed"
                  )}
                >
                  {avatarUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : hasCustomAvatar && preferences.customAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preferences.customAvatar}
                      alt="自定义头像"
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isCustomSelected && <SelectedBadge />}
                {hasCustomAvatar && (
                  <button
                    type="button"
                    title="移除自定义头像"
                    aria-label="移除自定义头像"
                    onClick={removeCustomAvatar}
                    className="absolute -bottom-1.5 -right-1.5 rounded-full border bg-background p-0.5 shadow-sm hover:bg-accent"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 我的头像：默认 + 预设 + 从设备上传 */}
          <div className="space-y-2 border-t pt-4">
            <Label>我的头像</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {/* 默认样式格 */}
                  <button
                    type="button"
                    title="默认"
                    aria-label="头像：默认"
                    onClick={() =>
                      updatePreferences({
                        userAvatarId: DEFAULT_USER_AVATAR_ID,
                      })
                    }
                    className={cn(
                      "relative flex aspect-square w-full items-center justify-center rounded-md border p-1 transition-colors hover:bg-accent",
                      currentUserAvatarId === DEFAULT_USER_AVATAR_ID
                        ? "border-ring"
                        : "border-transparent"
                    )}
                  >
                    <UserAvatar
                      avatarId={DEFAULT_USER_AVATAR_ID}
                      className="h-9 w-9"
                    />
                    {currentUserAvatarId === DEFAULT_USER_AVATAR_ID && (
                      <SelectedBadge />
                    )}
                  </button>

                  {/* 预设格 */}
                  {AVATAR_PRESETS.map((preset) => {
                    const selected = preset.id === currentUserAvatarId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.label}
                        aria-label={`头像：${preset.label}`}
                        onClick={() =>
                          updatePreferences({ userAvatarId: preset.id })
                        }
                        className={cn(
                          "relative flex aspect-square w-full items-center justify-center rounded-md border p-1 transition-colors hover:bg-accent",
                          selected ? "border-ring" : "border-transparent"
                        )}
                      >
                        <UserAvatar
                          avatarId={preset.id}
                          className="h-9 w-9"
                        />
                        {selected && <SelectedBadge />}
                      </button>
                    );
                  })}

                  {/* 我的自定义头像格 */}
                  <input
                    ref={userAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void uploadAvatarImage(e.target.files?.[0], true);
                      e.target.value = "";
                    }}
                  />
                  <div className="relative">
                    <button
                      type="button"
                      title={
                        !hasUserCustomAvatar
                          ? "从设备选择头像"
                          : isUserCustomSelected
                            ? "更换自定义头像"
                            : "使用自定义头像"
                      }
                      aria-label="自定义头像"
                      disabled={userAvatarUploading}
                      onClick={handleUserCustomCellClick}
                      className={cn(
                        "flex aspect-square w-full items-center justify-center rounded-md border p-1 transition-colors hover:bg-accent disabled:opacity-60",
                        isUserCustomSelected ? "border-ring" : "border-dashed"
                      )}
                    >
                      {userAvatarUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : hasUserCustomAvatar &&
                        preferences.userCustomAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preferences.userCustomAvatar}
                          alt="自定义头像"
                          className="h-9 w-9 rounded object-cover"
                        />
                      ) : (
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {isUserCustomSelected && <SelectedBadge />}
                    {hasUserCustomAvatar && (
                      <button
                        type="button"
                        title="移除自定义头像"
                        aria-label="移除自定义头像"
                        onClick={removeUserCustomAvatar}
                        className="absolute -bottom-1.5 -right-1.5 rounded-full border bg-background p-0.5 shadow-sm hover:bg-accent"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
            <p className="text-xs text-muted-foreground">
              点击虚线格从设备上传图片，仅保存在本地浏览器。
            </p>
          </div>

          {/* 聊天背景 */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>聊天背景</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handleBgFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bgUploading}
                    onClick={() => bgInputRef.current?.click()}
                  >
                    {bgUploading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ImagePlus />
                    )}
                    {bgUploading ? "处理中…" : "从设备选择"}
                  </Button>
                  {hasBackground && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={removeBackground}
                    >
                      清除
                    </Button>
                  )}
                </div>
              </div>

              {hasBackground && preferences.chatBackground ? (
                <div className="space-y-3">
                  <div
                    className="h-20 rounded-md border bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${preferences.chatBackground})`,
                    }}
                  />
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">
                      背景强度
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={bgOpacity}
                      onChange={(e) =>
                        updatePreferences({
                          chatBackgroundOpacity: Number(e.target.value),
                        })
                      }
                      className="h-1.5 flex-1 cursor-pointer accent-primary"
                      aria-label="背景强度"
                    />
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {bgOpacity}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    数值越低背景越淡，越高越明显；切换明暗主题时自动适配。
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  选择一张图片作为聊天界面背景，仅保存在本地浏览器。
                </p>
              )}
            </div>
          </div>

          {/* 预制 Prompt */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">预制 Prompt</Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  "例如：\n你是一位专业的编程助手，回答简洁准确，默认使用中文。"
                }
                rows={6}
                className="resize-y"
              />
              <p className="text-xs text-muted-foreground">
                会作为 System Prompt
                随每次对话请求发送，用于设定 AI 的角色与行为。仅保存在本地浏览器。
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={closeWithCommit}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
