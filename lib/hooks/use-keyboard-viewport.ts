"use client";

import * as React from "react";

/**
 * 移动端软键盘适配：
 * - Android Chrome 108+ 依赖 viewport meta 的 interactive-widget=resizes-content
 * - iOS Safari 不支持该属性，需用 visualViewport API 动态压缩应用高度，
 *   避免键盘弹起时整个页面被顶起（顶栏滚出屏幕）
 */
export function useKeyboardViewport() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const root = document.documentElement;
      // 判定键盘弹起：可视高度明显小于窗口高度
      const keyboardOpen = vv.height < window.innerHeight - 80;
      if (keyboardOpen) {
        root.style.setProperty("--app-height", `${vv.height}px`);
        // 修正 iOS 把页面顶起产生的偏移
        if (vv.offsetTop > 0) {
          window.scrollTo(0, 0);
        }
      } else {
        root.style.removeProperty("--app-height");
      }
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
}
