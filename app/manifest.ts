import type { MetadataRoute } from "next";

/** PWA Web App Manifest：安卓 Chrome 安装必需 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Chat",
    short_name: "AI Chat",
    description: "轻量、现代化的 AI 聊天，支持任意 OpenAI-compatible API。",
    start_url: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    lang: "zh-CN",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
