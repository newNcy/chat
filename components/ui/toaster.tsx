"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (opts: {
    title?: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** 全局单例引用，方便非组件环境调用 */
let externalToast: ToastContextValue["toast"] | null = null;

export function toast(opts: {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}) {
  externalToast?.(opts);
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return { toast: (() => {}) as ToastContextValue["toast"] };
  }
  return ctx;
}

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; className: string }
> = {
  default: { icon: <Info className="h-4 w-4" />, className: "" },
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    className: "",
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 text-destructive" />,
    className: "border-destructive/40",
  },
  info: { icon: <Info className="h-4 w-4 text-blue-500" />, className: "" },
};

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const remove = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = React.useCallback<ToastContextValue["toast"]>(
    (opts) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        id,
        title: opts.title,
        description: opts.description,
        variant: opts.variant ?? "default",
        duration: opts.duration ?? 4000,
      };
      setItems((prev) => [...prev, item]);
      if (item.duration > 0) {
        setTimeout(() => remove(id), item.duration);
      }
    },
    [remove]
  );

  React.useEffect(() => {
    externalToast = add;
    return () => {
      externalToast = null;
    };
  }, [add]);

  const value = React.useMemo<ToastContextValue>(() => ({ toast: add }), [add]);

  return (
    <ToastContext.Provider value={value}>
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
            {items.map((t) => {
              const cfg = variantConfig[t.variant];
              return (
                <div
                  key={t.id}
                  className={cn(
                    "pointer-events-auto flex items-start gap-3 rounded-lg border bg-background p-4 shadow-lg animate-fade-in",
                    cfg.className
                  )}
                >
                  <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                  <div className="flex-1 space-y-1">
                    {t.title && (
                      <p className="text-sm font-medium leading-tight">
                        {t.title}
                      </p>
                    )}
                    {t.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => remove(t.id)}
                    className="shrink-0 opacity-60 hover:opacity-100"
                    aria-label="关闭"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
