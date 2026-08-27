// 图片压缩工具：将用户选择的图片文件压缩为 data URL 存入 localStorage。
// 头像与聊天背景都需要控制体积，避免超出浏览器存储配额。

export interface CompressOptions {
  /** 最大边长（像素），超出时等比缩小 */
  maxSize: number;
  /** 压缩质量 0-1（对 JPEG/WebP 有效），默认 0.85 */
  quality?: number;
  /** 输出格式；不指定时 PNG 源图输出 PNG（保留透明），其余输出 JPEG */
  mimeType?: "image/jpeg" | "image/png";
  /** 转 JPEG 时是否用白色填充透明区域（避免黑底），默认 true */
  fillWhite?: boolean;
}

/**
 * 将图片文件压缩为 data URL。
 * @throws 当文件不是图片、读取或解码失败时抛出异常
 */
export function fileToCompressedDataUrl(
  file: File,
  options: CompressOptions
): Promise<string> {
  const { maxSize, quality = 0.85, mimeType, fillWhite = true } = options;

  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("所选文件不是图片"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("图片解码失败"));
      img.onload = () => {
        try {
          const scale = Math.min(
            1,
            maxSize / Math.max(img.width, img.height)
          );
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("无法创建画布"));
            return;
          }

          const outputMime =
            mimeType ??
            (file.type === "image/png" ? "image/png" : "image/jpeg");

          // JPEG 不支持透明：先用白色铺底，避免透明区域变黑
          if (outputMime === "image/jpeg" && fillWhite) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
          }

          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL(outputMime, quality));
        } catch (e) {
          reject(e instanceof Error ? e : new Error("图片处理失败"));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
