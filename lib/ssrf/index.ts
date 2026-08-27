// SSRF 防护：对用户提供的 Base URL 做严格校验。
//
// 该应用允许用户填写任意 API Endpoint，服务器端会代为请求，
// 因此必须防止用户借此访问内网 / 云平台 metadata / 本机服务。
//
// 策略：
// 1. 仅允许 http / https 协议
// 2. 禁止用户名/密码内嵌（http://user:pass@host）
// 3. 对 hostname 做规范化后检查
// 4. 禁止 localhost、私有 IP、link-local、保留地址
// 5. 禁止云平台 metadata endpoint（169.254.169.254 等）
// 6. IPv4/IPv6 均覆盖，包含各种进制/压缩写法

/** 校验结果 */
export interface SsrfCheckResult {
  ok: boolean;
  /** 校验失败原因（面向开发/日志，不含敏感信息） */
  reason?: string;
  /** 规范化后的 URL（校验通过时） */
  normalizedUrl?: string;
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// 明确禁止的主机名（小写）
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  // 云平台 metadata 常见域名
  "metadata.google.internal",
  "metadata.goog",
]);

/** 将 IPv4 各段字符串（可能是十进制/十六进制/八进制）解析为 0-255 数字 */
function parseIPv4Octet(part: string): number | null {
  let value: number;
  if (/^0x[0-9a-f]+$/i.test(part)) {
    value = parseInt(part, 16);
  } else if (/^0[0-7]+$/.test(part)) {
    value = parseInt(part, 8);
  } else if (/^\d+$/.test(part)) {
    value = parseInt(part, 10);
  } else {
    return null;
  }
  if (Number.isNaN(value) || value < 0 || value > 255) return null;
  return value;
}

/** 尝试把 hostname 解析成 IPv4 四元组（支持异常写法，如 0x7f000001、2130706433） */
function resolveIPv4(hostname: string): [number, number, number, number] | null {
  // 纯整数写法：如 2130706433 => 127.0.0.1
  if (/^\d+$/.test(hostname)) {
    const n = Number(hostname);
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  // 十六进制整体写法：如 0x7f000001
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    const n = parseInt(hostname, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }

  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    const v = parseIPv4Octet(p);
    if (v === null) return null;
    octets.push(v);
  }
  return octets as [number, number, number, number];
}

/** 判断 IPv4 是否属于禁止范围 */
function isBlockedIPv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;
  // 0.0.0.0/8 —— 本网络 / 0.0.0.0
  if (a === 0) return true;
  // 10.0.0.0/8 —— 私有
  if (a === 10) return true;
  // 127.0.0.0/8 —— 回环
  if (a === 127) return true;
  // 100.64.0.0/10 —— 运营商级 NAT（内网共享地址）
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 169.254.0.0/16 —— link-local（含云 metadata 169.254.169.254）
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 —— 私有
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24、192.0.2.0/24 —— 保留/文档
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16 —— 私有
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 —— 基准测试
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24、203.0.113.0/24 —— 文档
  // 224.0.0.0/4 —— 组播；240.0.0.0/4 —— 保留
  if (a >= 224) return true;
  return false;
}

/** 展开 IPv6 为 8 组 16 位十六进制 */
function expandIPv6(hostname: string): string[] | null {
  let host = hostname;
  // 去掉方括号
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  // 去掉 zone id（%eth0）
  const percentIndex = host.indexOf("%");
  if (percentIndex >= 0) host = host.slice(0, percentIndex);

  if (!host.includes(":")) return null;

  // 处理内嵌 IPv4（如 ::ffff:127.0.0.1）
  const lastColon = host.lastIndexOf(":");
  const tail = host.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = resolveIPv4(tail);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    host = host.slice(0, lastColon + 1) + hi + ":" + lo;
  }

  const doubleColonParts = host.split("::");
  if (doubleColonParts.length > 2) return null;

  let head: string[] = [];
  let rear: string[] = [];
  if (doubleColonParts.length === 2) {
    head = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
    rear = doubleColonParts[1] ? doubleColonParts[1].split(":") : [];
    const missing = 8 - head.length - rear.length;
    if (missing < 0) return null;
    const zeros = new Array(missing).fill("0");
    return [...head, ...zeros, ...rear].map(normalizeHextet);
  }

  const groups = host.split(":");
  if (groups.length !== 8) return null;
  return groups.map(normalizeHextet);
}

function normalizeHextet(h: string): string {
  if (!/^[0-9a-f]{1,4}$/i.test(h)) return "invalid";
  return parseInt(h, 16).toString(16);
}

/** 判断 IPv6 是否属于禁止范围 */
function isBlockedIPv6(groups: string[]): boolean {
  if (groups.some((g) => g === "invalid")) return true;
  const nums = groups.map((g) => parseInt(g, 16));
  if (nums.some((n) => Number.isNaN(n))) return true;

  // ::  (未指定地址) 与 ::1 (回环)
  const allZeroExceptLast =
    nums.slice(0, 7).every((n) => n === 0);
  if (allZeroExceptLast && (nums[7] === 0 || nums[7] === 1)) return true;

  const first = nums[0];
  // fe80::/10 —— link-local
  if ((first & 0xffc0) === 0xfe80) return true;
  // fc00::/7 —— 唯一本地地址（ULA，私有）
  if ((first & 0xfe00) === 0xfc00) return true;
  // ::ffff:0:0/96 —— IPv4-mapped，此时前面已被展开成十六进制，
  // 但保险起见：若前 5 组为 0 且第 6 组为 ffff，取后 2 组当 IPv4 检查
  if (
    nums[0] === 0 &&
    nums[1] === 0 &&
    nums[2] === 0 &&
    nums[3] === 0 &&
    nums[4] === 0 &&
    nums[5] === 0xffff
  ) {
    const a = (nums[6] >> 8) & 255;
    const b = nums[6] & 255;
    const c = (nums[7] >> 8) & 255;
    const d = nums[7] & 255;
    if (isBlockedIPv4([a, b, c, d])) return true;
  }
  return false;
}

/**
 * 校验用户提供的 Base URL 是否安全可用。
 * 注意：这是基于字符串/字面 IP 的静态校验。DNS 解析层面的
 * rebinding 无法在此完全防御，但已覆盖绝大多数直接 SSRF 场景。
 */
export function checkBaseUrlSafety(rawUrl: string): SsrfCheckResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, reason: "URL 为空" };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: false, reason: "URL 为空" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "URL 格式无效" };
  }

  // 1. 协议白名单
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "仅允许 http 或 https 协议" };
  }

  // 2. 禁止内嵌凭证
  if (url.username || url.password) {
    return { ok: false, reason: "URL 不允许包含用户名或密码" };
  }

  // 3. hostname 规范化（URL 已对大小写、punycode 做处理）
  let hostname = url.hostname.toLowerCase();
  // 去掉 IPv6 的方括号以便判断
  const isBracketed = hostname.startsWith("[") && hostname.endsWith("]");
  const bareHost = isBracketed ? hostname.slice(1, -1) : hostname;

  if (!bareHost) {
    return { ok: false, reason: "主机名为空" };
  }

  // 4. 明确禁止的主机名
  if (BLOCKED_HOSTNAMES.has(bareHost)) {
    return { ok: false, reason: "禁止访问该主机" };
  }

  // 5. 以 .local / .internal 结尾的内部域名
  if (
    bareHost.endsWith(".local") ||
    bareHost.endsWith(".internal") ||
    bareHost.endsWith(".localhost")
  ) {
    return { ok: false, reason: "禁止访问内部域名" };
  }

  // 6. IPv6 字面量
  if (bareHost.includes(":")) {
    const groups = expandIPv6(bareHost);
    if (!groups) {
      return { ok: false, reason: "无效的 IPv6 地址" };
    }
    if (isBlockedIPv6(groups)) {
      return { ok: false, reason: "禁止访问该 IP 地址范围" };
    }
    return { ok: true, normalizedUrl: url.toString() };
  }

  // 7. IPv4 字面量（含异常进制写法）
  const v4 = resolveIPv4(bareHost);
  if (v4) {
    if (isBlockedIPv4(v4)) {
      return { ok: false, reason: "禁止访问该 IP 地址范围" };
    }
    return { ok: true, normalizedUrl: url.toString() };
  }

  // 8. 普通域名：通过字面检查（DNS 解析交由平台，无法在此完全防 rebinding）
  //    额外拦截一些明显的内部单标签主机名
  if (!bareHost.includes(".")) {
    return { ok: false, reason: "禁止访问单标签主机名" };
  }

  return { ok: true, normalizedUrl: url.toString() };
}
