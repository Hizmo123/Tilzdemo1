import type { NextConfig } from "next";

// Standard, safe HTTP security headers applied to every route. (A strict
// Content-Security-Policy is deliberately omitted here — it needs live testing
// against Supabase/Next inline scripts before enabling, so it belongs with the
// production-hardening pass rather than a blind default.)
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
