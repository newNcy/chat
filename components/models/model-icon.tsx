"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { getModelIconUrl, getProviderMeta } from "@/lib/models/provider";

interface ModelIconProps {
  model: string;
  className?: string;
  size?: "sm" | "md";
}

const SIZE = { sm: "h-3.5 w-3.5", md: "h-4 w-4" } as const;

export function ModelIcon({ model, className, size = "sm" }: ModelIconProps) {
  const { resolvedTheme } = useTheme();
  const meta = getProviderMeta(model);
  const isLight = resolvedTheme === "light";
  // preferTheme: 优先加载的资源；fallbackInvert: light 下 dark 资源反色兜底
  const [mode, setMode] = React.useState<"prefer" | "invert" | "letter">(
    "prefer"
  );

  const preferSrc = getModelIconUrl(
    meta.iconId,
    isLight ? "light" : "dark"
  );
  const darkSrc = getModelIconUrl(meta.iconId, "dark");

  React.useEffect(() => {
    setMode("prefer");
  }, [preferSrc, isLight]);

  if (mode === "letter") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-[8px] font-bold leading-none text-white",
          SIZE[size],
          className
        )}
        style={{ backgroundColor: meta.color }}
        aria-hidden
      >
        {meta.letter}
      </span>
    );
  }

  const src = mode === "invert" ? darkSrc : preferSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={`${src}-${mode}`}
      src={src}
      alt=""
      className={cn(
        "shrink-0 rounded-sm object-contain",
        SIZE[size],
        mode === "invert" && "invert",
        className
      )}
      onError={() => {
        if (mode === "prefer" && isLight) {
          setMode("invert");
        } else {
          setMode("letter");
        }
      }}
    />
  );
}
