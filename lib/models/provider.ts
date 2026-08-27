/** 从模型 id 推断提供商（用于展示 logo） */
export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "meta"
  | "deepseek"
  | "mistral"
  | "qwen"
  | "grok"
  | "cohere"
  | "azure"
  | "glm"
  | "moonshot"
  | "yi"
  | "baichuan"
  | "huggingface"
  | "unknown";

export interface ProviderMeta {
  provider: ModelProvider;
  /** Lobe Icons 静态资源 id */
  iconId: string;
  /** CDN 加载失败时的缩写 */
  letter: string;
  color: string;
}

const PROVIDER_RULES: { provider: ModelProvider; test: RegExp }[] = [
  { provider: "openai", test: /(^|\/)gpt-|^(chatgpt|o1|o3|o4|text-davinci|text-embedding)/ },
  { provider: "anthropic", test: /claude|anthropic/ },
  { provider: "google", test: /gemini|palm|bard|google/ },
  { provider: "meta", test: /llama|meta-llama|meta\// },
  { provider: "deepseek", test: /deepseek/ },
  { provider: "mistral", test: /mistral|mixtral|codestral|pixtral/ },
  { provider: "qwen", test: /qwen|qwq/ },
  { provider: "grok", test: /grok|x-ai|xai/ },
  { provider: "cohere", test: /cohere|command-/ },
  { provider: "azure", test: /azure/ },
  { provider: "glm", test: /glm|chatglm|zhipu/ },
  { provider: "moonshot", test: /moonshot|kimi/ },
  { provider: "yi", test: /(^|\/)yi-/ },
  { provider: "baichuan", test: /baichuan/ },
  { provider: "huggingface", test: /huggingface|(^|\/)hf\// },
];

const META: Record<ModelProvider, Omit<ProviderMeta, "provider">> = {
  openai: { iconId: "openai", letter: "O", color: "#10A37F" },
  anthropic: { iconId: "claude", letter: "A", color: "#D4A574" },
  google: { iconId: "gemini", letter: "G", color: "#4285F4" },
  meta: { iconId: "meta", letter: "M", color: "#0668E1" },
  deepseek: { iconId: "deepseek", letter: "D", color: "#4D6BFE" },
  mistral: { iconId: "mistral", letter: "Mi", color: "#F54D42" },
  qwen: { iconId: "qwen", letter: "Q", color: "#6157F9" },
  grok: { iconId: "xai", letter: "X", color: "#000000" },
  cohere: { iconId: "cohere", letter: "C", color: "#39594D" },
  azure: { iconId: "azure", letter: "Az", color: "#0078D4" },
  glm: { iconId: "zhipu", letter: "Z", color: "#2F54EB" },
  moonshot: { iconId: "moonshot", letter: "K", color: "#000000" },
  yi: { iconId: "yi", letter: "Y", color: "#6B4EFF" },
  baichuan: { iconId: "baichuan", letter: "B", color: "#FF6A00" },
  huggingface: { iconId: "huggingface", letter: "H", color: "#FFD21E" },
  unknown: { iconId: "openrouter", letter: "?", color: "#6B7280" },
};

export function getModelProvider(modelId: string): ModelProvider {
  const m = modelId.toLowerCase();
  if (m.includes("openai")) return "openai";
  for (const { provider, test } of PROVIDER_RULES) {
    if (test.test(m)) return provider;
  }
  return "unknown";
}

export function getProviderMeta(modelId: string): ProviderMeta {
  const provider = getModelProvider(modelId);
  return { provider, ...META[provider] };
}

export function getModelIconUrl(
  iconId: string,
  theme: "light" | "dark" = "dark"
): string {
  return `https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/${theme}/${iconId}.png`;
}
