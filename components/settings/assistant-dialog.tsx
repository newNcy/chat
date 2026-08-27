"use client";

import * as React from "react";
import { ImagePlus, Loader2 } from "lucide-react";
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
  UserAvatar,
  AVATAR_PRESETS,
  CUSTOM_AVATAR_ID,
  DEFAULT_USER_AVATAR_ID,
} from "@/components/chat/ai-avatar";
import {
  AvatarPicker,
  SelectedBadge,
} from "@/components/settings/avatar-picker";
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

/** 对话设置：自定义 AI 与我的形象、聊天背景、预制 Prompt */
export function AssistantDialog({ open, onOpenChange }: AssistantDialogProps) {
  const { preferences, updatePreferences } = useAppStore();

  // 名称与 Prompt 为本地编辑态，关闭时统一提交；头像/背景即时生效
  const [name, setName] = React.useState(preferences.aiName);
  const [prompt, setPrompt] = React.useState(preferences.systemPrompt);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const [userAvatarUploading, setUserAvatarUploading] = React.useState(false);
  const [bgUploading, setBgUploading] = React.useState(false);

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

  const removeCustomAvatar = () => {
    updatePreferences({
      aiAvatarId: AVATAR_PRESETS[0].id,
      customAvatar: "",
    });
  };

  // ---------- 我的头像 ----------

  const currentUserAvatarId =
    preferences.userAvatarId ?? DEFAULT_USER_AVATAR_ID;

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
            自定义 AI 与你的形象、聊天背景与预制 Prompt，仅对当前对话生效。
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

          {/* AI 头像：预设 + 从设备上传（与我的头像共用 AvatarPicker 组件） */}
          <div className="space-y-2">
            <Label>AI 头像</Label>
            <AvatarPicker
              avatarId={preferences.aiAvatarId}
              customAvatar={preferences.customAvatar}
              uploading={avatarUploading}
              onSelect={(id) => updatePreferences({ aiAvatarId: id })}
              onUpload={(file) => void uploadAvatarImage(file, false)}
              onRemoveCustom={removeCustomAvatar}
            />
          </div>

          {/* 我的头像：默认 + 预设 + 从设备上传（与 AI 头像共用 AvatarPicker 组件） */}
          <div className="space-y-2 border-t pt-4">
            <Label>我的头像</Label>
            <AvatarPicker
              avatarId={currentUserAvatarId}
              customAvatar={preferences.userCustomAvatar}
              uploading={userAvatarUploading}
              leadingSlot={
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
              }
              onSelect={(id) => updatePreferences({ userAvatarId: id })}
              onUpload={(file) => void uploadAvatarImage(file, true)}
              onRemoveCustom={removeUserCustomAvatar}
            />
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
