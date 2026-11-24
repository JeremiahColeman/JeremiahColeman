import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// The browser talks to this site and to Supabase (REST, Auth, Realtime) only.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const supabaseOrigins = supabase
  ? [supabase.origin, `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`]
  : [];

// Without nonces, because signed-in pages use a prerendered static shell
// (see the Next.js CSP guide). Still limits where the page can connect, what
// can frame it, and where forms can post.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Product pictures come from any store.
  "img-src 'self' https: data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigins.join(" ")}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabase?.origin ?? ""} https://accounts.google.com`,
  "manifest-src 'self'",
  "worker-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
