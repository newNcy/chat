"use client";

import * as React from "react";

/**
 * 移动端软键盘适配（iOS / Android 通用）：
 * 聚焦输入控件时把应用高度压缩到 visualViewport 可视高度（键盘上方），
 * 失焦后恢复。不依赖 viewport meta（iOS 不支持）与高度阈值比较（Android 不可靠）。
 */
export function useKeyboardViewport() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    let focused = false;
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;

    const apply = () => {
      if (restoreTimer) {
        clearTimeout(restoreTimer);
        restoreTimer = null;
      }
      if (focused) {
        // 键盘显示中：高度压缩到键盘上方的可视区域
        root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
        // 修正 iOS 把页面顶起产生的偏移
        if (vv.offsetTop > 0) {
          window.scrollTo(0, 0);
        }
        window.dispatchEvent(new Event("app-keyboard-viewport"));
      } else {
        root.style.removeProperty("--app-height");
        window.dispatchEvent(new Event("app-keyboard-viewport"));
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        focused = true;
        // 等一帧让 visualViewport 先更新
        requestAnimationFrame(apply);
      }
    };

    const onFocusOut = () => {
      focused = false;
      // 延迟恢复，等键盘收起动画完成
      restoreTimer = setTimeout(apply, 150);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      if (restoreTimer) clearTimeout(restoreTimer);
      root.style.removeProperty("--app-height");
    };
  }, []);
}
