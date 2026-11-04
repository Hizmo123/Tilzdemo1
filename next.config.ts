import type { NextConfig } from "next";

// Standard, safe HTTP security headers applied to every route. (A strict
// Content-Security-Policy is deliberately omitted here — it needs live testing
// against Supabase/Next inline scripts before enabling, so it belongs with the
// production-hardening pass rather than a blind default.)
// CSP ships Report-Only first: Next injects inline scripts and the app talks to
// Supabase/Square/Stripe, so enforce only after watching the browser console on
// a live deploy for violations. Flip the header key to
// "Content-Security-Policy" once clean.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://web.squarecdn.com https://sandbox.web.squarecdn.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://web.squarecdn.com https://sandbox.web.squarecdn.com",
  "font-src 'self' data: https://fonts.gstatic.com https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
  "img-src 'self' data: blob: https://*.supabase.co https://*.squarecdn.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.squareup.com https://*.squareupsandbox.com https://pci-connect.squareup.com https://pci-connect.squareupsandbox.com",
  "frame-src https://js.stripe.com https://checkout.stripe.com https://web.squarecdn.com https://sandbox.web.squarecdn.com https://pci-connect.squareup.com https://pci-connect.squareupsandbox.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
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
  // Off (the Next.js default) and explicit, not left to fall through: a
  // source map isn't just "readable JS", it reconstructs original file
  // paths, variable/function names and comments — enough to hand anyone
  // Tillz's fee-calculation logic, the auth/session flow, and every server
  // action's real name, straight from the client bundle. Debugging a
  // user's crash report from a minified stack trace is a worse trade than
  // that exposure.
  productionBrowserSourceMaps: false,
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
