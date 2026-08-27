"use client";

import {
  Bot,
  Sparkles,
  Zap,
  Brain,
  Gem,
  Cpu,
  Rocket,
  Terminal,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** 头像预设 */
export interface AvatarPreset {
  id: string;
  label: string;
  icon: LucideIcon;
  /** 背景色 */
  className: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "bot", label: "机器人", icon: Bot, className: "bg-violet-600" },
  { id: "sparkles", label: "星光", icon: Sparkles, className: "bg-amber-500" },
  { id: "zap", label: "闪电", icon: Zap, className: "bg-sky-500" },
  { id: "brain", label: "大脑", icon: Brain, className: "bg-emerald-600" },
  { id: "gem", label: "宝石", icon: Gem, className: "bg-rose-500" },
  { id: "cpu", label: "芯片", icon: Cpu, className: "bg-slate-500" },
  { id: "rocket", label: "火箭", icon: Rocket, className: "bg-indigo-500" },
  { id: "terminal", label: "终端", icon: Terminal, className: "bg-zinc-600" },
];

/** 自定义头像的 id */
export const CUSTOM_AVATAR_ID = "custom";

/** 用户头像的默认样式 id */
export const DEFAULT_USER_AVATAR_ID = "default";

interface AvatarProps {
  /** 头像 id；CUSTOM_AVATAR_ID 时渲染自定义图片 */
  avatarId: string;
  /** 自定义头像 data URL */
  customAvatar?: string;
  /** 尺寸等附加类名，如 h-7 w-7 */
  className?: string;
}

/** 按预设渲染头像 */
function PresetAvatar({
  preset,
  className,
}: {
  preset: AvatarPreset;
  className?: string;
}) {
  const Icon = preset.icon;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md text-white",
        preset.className,
        className
      )}
    >
      <Icon className="h-[55%] w-[55%]" />
    </div>
  );
}

/** 对话中的 AI 头像：优先渲染自定义图片，其次按预设渲染 */
export function AiAvatar({ avatarId, customAvatar, className }: AvatarProps) {
  if (avatarId === CUSTOM_AVATAR_ID && customAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customAvatar}
        alt="AI 头像"
        className={cn("shrink-0 rounded-md object-cover", className)}
      />
    );
  }

  const preset =
    AVATAR_PRESETS.find((p) => p.id === avatarId) ?? AVATAR_PRESETS[0];
  return <PresetAvatar preset={preset} className={className} />;
}

/** 用户头像：默认样式 / 预设 / 自定义图片 */
export function UserAvatar({ avatarId, customAvatar, className }: AvatarProps) {
  if (avatarId === CUSTOM_AVATAR_ID && customAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customAvatar}
        alt="我的头像"
        className={cn("shrink-0 rounded-md object-cover", className)}
      />
    );
  }

  if (avatarId === DEFAULT_USER_AVATAR_ID) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground",
          className
        )}
      >
        <User className="h-[55%] w-[55%]" />
      </div>
    );
  }

  const preset =
    AVATAR_PRESETS.find((p) => p.id === avatarId) ?? AVATAR_PRESETS[0];
  return <PresetAvatar preset={preset} className={className} />;
}
