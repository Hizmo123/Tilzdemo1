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
    // camera=(self): scan-to-activate (Stands, qr-scanner) needs the
    // browser to prompt for camera access on this site's own pages. Still
    // blocks camera for any third-party/framed context — just allows
    // first-party use, unlike the blanket camera=() this replaces.
    // microphone/geolocation stay locked down — nothing in the app uses
    // either.
    value: "camera=(self), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  // Lets the browser map minified crash stack traces back to real file/line
  // in devtools, so intermittent client-side errors are debuggable from a
  // user's report instead of guesswork. Source is already public via the JS
  // bundle either way; this just makes it readable.
  productionBrowserSourceMaps: true,
  // Strips console.log/info/debug from production client bundles (server
  // code is untouched — this only affects what ships to the browser).
  // console.error/warn survive so real client-side failures still surface.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  images: {
    // Wildcard subdomain, not the specific project ref, so this doesn't
    // silently break if the Supabase project is ever swapped — menu/logo/
    // background images are all served from *.supabase.co Storage URLs.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
