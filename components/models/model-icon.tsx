"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { getModelIconUrl, getProviderMeta } from "@/lib/models/provider";

interface ModelIconProps {
  model: string;
  className?: string;
  size?: "sm" | "md";
}

const SIZE = { sm: "h-3.5 w-3.5", md: "h-4 w-4" } as const;

export function ModelIcon({ model, className, size = "sm" }: ModelIconProps) {
  const meta = getProviderMeta(model);
  const [failed, setFailed] = React.useState(false);

  if (failed) {
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getModelIconUrl(meta.iconId)}
      alt=""
      className={cn("shrink-0 rounded-sm object-contain", SIZE[size], className)}
      onError={() => setFailed(true)}
    />
  );
}
