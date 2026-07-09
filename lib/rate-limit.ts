/**
 * 内存滑窗限流。
 *
 * MVP 阶段不用 Upstash Redis，用进程内存 Map 做限流。
 * 算法：滑动窗口——记录每个 key(IP) 的请求时间戳数组，
 * 每次请求时清除超过窗口的旧时间戳，检查剩余数量是否超限。
 *
 * 局限性：只在单实例下准确。Vercel 多实例部署时每个实例有独立 Map，
 * 实际限制 = 实例数 × limit。MVP 阶段够用，上线后换 Redis。
 *
 * 另一个局限：Map 会无限增长。用定期清理避免内存泄漏
 * (每次检查时顺便清除过期的 key)。
 */

// key → 时间戳数组
const store = new Map<string, number[]>();

interface RateLimitOptions {
  /** 限制窗口(毫秒)，默认 1 小时 */
  windowMs?: number;
  /** 窗口内最大请求数，默认 20 */
  max?: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** 重置时间(Unix 毫秒) */
  resetAt: number;
}

/**
 * 检查是否允许请求。
 *
 * @param key 限流标识(通常是 IP 地址)
 * @param options 限流参数
 * @returns { success, remaining, resetAt }
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const windowMs = options.windowMs ?? 60 * 60 * 1000; // 1 小时
  const max = options.max ?? 20;
  const now = Date.now();
  const windowStart = now - windowMs;

  // 取出该 key 的历史时间戳
  let timestamps = store.get(key) || [];

  // 清除窗口外的旧时间戳
  timestamps = timestamps.filter((t) => t > windowStart);

  // 顺便清理整个 Map 里过期的 key(每 100 次请求清理一次，避免每次都遍历)
  if (store.size > 1000) {
    for (const [k, ts] of store.entries()) {
      const recent = ts.filter((t) => t > windowStart);
      if (recent.length === 0) {
        store.delete(k);
      } else {
        store.set(k, recent);
      }
    }
  }

  if (timestamps.length >= max) {
    // 超限
    return {
      success: false,
      remaining: 0,
      resetAt: timestamps[0] + windowMs,
    };
  }

  // 允许请求，记录时间戳
  timestamps.push(now);
  store.set(key, timestamps);

  return {
    success: true,
    remaining: max - timestamps.length,
    resetAt: now + windowMs,
  };
}

/**
 * 从请求头提取客户端 IP。
 *
 * Vercel/代理环境下，真实 IP 在 x-forwarded-for 或 x-real-ip 里。
 * 取 x-forwarded-for 的第一个(最原始的客户端 IP)。
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP.trim();
  return "unknown";
}
