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
