// A fixed-window per-key rate limiter, in memory. No external store — this is
// a best-effort layer, not a hard guarantee. On Vercel a serverless function
// instance can be reused across many requests in quick succession (the common
// case this defends: one script hammering one route from one source), but a
// cold start or a different instance starts a fresh counter, and a botnet
// spread across many source IPs isn't slowed by this at all. That's a real
// limitation of "no new dependency, no Redis" — worth a durable store (Upstash
// Ratelimit, Vercel's own, etc.) if abuse becomes an actual problem; this is
// the honest starting point, not a promise it can't be routed around.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

// Best-effort client identifier from standard proxy headers (Vercel sets
// x-forwarded-for). Never trust this for anything beyond throttling — it's
// client-suppliable and only meaningful because Vercel's edge overwrites it
// for traffic that actually reaches the function.
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

// Async limiter used by server actions. Uses Upstash Redis over its REST API
// (no extra dependency) when UPSTASH_REDIS_REST_URL / _TOKEN are set, so
// counters are shared across serverless instances; otherwise falls back to the
// in-memory limiter above. If Upstash errors, falls back rather than failing
// the request.
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", `rl:${key}`],
          ["PEXPIRE", `rl:${key}`, String(windowMs), "NX"],
          ["PTTL", `rl:${key}`],
        ]),
        cache: "no-store",
      });
      if (res.ok) {
        const out = (await res.json()) as { result: number }[];
        const count = Number(out[0]?.result);
        const ttl = Number(out[2]?.result);
        if (Number.isFinite(count)) {
          return count > limit
            ? { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)) }
            : { allowed: true, retryAfterSeconds: 0 };
        }
      }
    } catch {
      // fall through to in-memory
    }
  }
  return checkRateLimit(key, limit, windowMs);
}

// Rate-limits the current server-action caller by IP. Returns an error string
// to hand back to the UI when blocked, else null.
export async function limitActionByIp(
  name: string,
  limit: number,
  windowMs: number,
  extra = "",
): Promise<string | null> {
  const { headers } = await import("next/headers");
  const ip = clientIp(await headers());
  const r = await rateLimit(`${name}:${extra}:${ip}`, limit, windowMs);
  return r.allowed ? null : "Too many requests. Please wait a moment and try again.";
}

// Non-incrementing check: has `key` already reached `limit` hits in its window?
// Pair with rateLimit() to record a hit (e.g. a failed PIN attempt).
export async function isRateLimited(key: string, limit: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const res = await fetch(`${url}/get/${encodeURIComponent(`rl:${key}`)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const { result } = (await res.json()) as { result: string | null };
        return Number(result ?? 0) >= limit;
      }
    } catch {
      // fall through to in-memory
    }
  }
  const b = buckets.get(key);
  return !!b && b.resetAt > Date.now() && b.count >= limit;
}
