"use client";

import * as React from "react";
import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { uid, cn } from "@/lib/utils";
import type { ImageAttachment } from "@/types";

interface ChatInputProps {
  onSend: (text: string, images: ImageAttachment[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  /** 顶部插槽：模型选择器 */
  toolbar?: React.ReactNode;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 单张图片 5MB 上限

export function ChatInput({
  onSend,
  onStop,
  streaming,
  disabled,
  toolbar,
}: ChatInputProps) {
  const [text, setText] = React.useState("");
  const [images, setImages] = React.useState<ImageAttachment[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 自适应高度
  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  const addImageFiles = React.useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    for (const file of list) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast({
          variant: "error",
          title: "图片过大",
          description: `「${file.name}」超过 5MB，已跳过。`,
        });
        continue;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        setImages((prev) => [
          ...prev,
          { id: uid(), dataUrl, name: file.name || "image" },
        ]);
      } catch {
        toast({
          variant: "error",
          title: "读取失败",
          description: `无法读取「${file.name}」。`,
        });
      }
    }
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      addImageFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addImageFiles(e.dataTransfer.files);
    }
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    if (streaming || disabled) return;
    onSend(trimmed, images);
    setText("");
    setImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t bg-transparent px-3 py-3 sm:px-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-1.5">
          {toolbar && <div className="shrink-0 pb-1.5">{toolbar}</div>}
          <div
            className={cn(
              "relative min-w-0 flex-1 rounded-lg border bg-background shadow-sm transition-colors",
            dragging && "border-primary ring-2 ring-primary/30",
            disabled && "opacity-60"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {/* 图片预览 */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 pb-0">
              {images.map((img) => (
                <div key={img.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-16 w-16 rounded-lg border object-cover"
                  />
                  <button
                    onClick={() =>
                      setImages((prev) => prev.filter((i) => i.id !== img.id))
                    }
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-background border p-0.5 shadow-sm hover:bg-accent"
                    aria-label="移除图片"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 输入行：文字与按钮同行（ChatGPT 式紧凑设计） */}
          <div className="flex items-end gap-1.5 p-1.5 pl-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={disabled}
              rows={1}
              placeholder={
                disabled ? "请先在设置中添加 API 配置…" : "输入消息…"
              }
              className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            <div className="flex shrink-0 items-center gap-1">
          {/* 上传图片 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addImageFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 rounded-full"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            aria-label="上传图片"
            title="上传图片"
          >
            <ImagePlus />
          </Button>

            {streaming ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="shrink-0 rounded-full"
                onClick={onStop}
                aria-label="停止生成"
                title="停止生成"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={submit}
                disabled={disabled || (!text.trim() && images.length === 0)}
                aria-label="发送"
                title="发送"
              >
                <ArrowUp />
              </Button>
            )}
            </div>
          </div>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-center text-[11px] text-muted-foreground">
          AI 可能会出错，请核对重要信息。所有配置与记录仅保存在本地浏览器。
        </p>
      </div>
    </div>
  );
}
