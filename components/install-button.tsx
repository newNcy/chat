"use client";

import * as React from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** 安装到桌面：安卓显示安装按钮，iOS 显示添加到主屏幕引导 */
export function InstallButton() {
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = React.useState(false);
  const [standalone, setStandalone] = React.useState(true); // 初始 true 避免闪烁
  const [guideOpen, setGuideOpen] = React.useState(false);

  React.useEffect(() => {
    // 已安装（standalone 模式）则不显示
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    if (isStandalone) return;

    // iOS / iPadOS 检测
    const ua = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    // 安卓 Chrome：拦截安装横幅，改为按钮触发
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || (!deferred && !isIOS)) return null;

  const handleInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
    } else if (isIOS) {
      setGuideOpen(true);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleInstall}
        aria-label="安装到桌面"
        title="安装到桌面"
      >
        <Download />
      </Button>

      {/* iOS 引导：Safari 无法编程安装，教用户手动添加 */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-sm" onClose={() => setGuideOpen(false)}>
          <DialogHeader>
            <DialogTitle>添加到主屏幕</DialogTitle>
            <DialogDescription>
              iOS 上需要通过 Safari 手动添加，两步即可。
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-4 py-2 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                1
              </span>
              <span className="flex items-center gap-2">
                点击 Safari 底部工具栏的
                <Share className="h-4 w-4 shrink-0" />
                「分享」按钮
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                2
              </span>
              <span className="flex items-center gap-2">
                在列表中选择
                <SquarePlus className="h-4 w-4 shrink-0" />
                「添加到主屏幕」
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
