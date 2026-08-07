import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

// Canonical origin this app is deployed at. Tenant sites proxy dashboard pages
// under their own hostname, so in production the browser URL is the customer's
// domain while the HTML comes from here.
const CANONICAL_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://www.ditchtheform.com"
).replace(/\/$/, "");

// Serve chunks/optimized images from the canonical origin so proxied pages
// work on tenant hostnames. Skipped on Vercel preview deployments, which must
// keep serving their own build's assets.
const useCanonicalAssets =
  process.env.VERCEL_ENV === "production" || !process.env.VERCEL;

const nextConfig: NextConfig = {
  // Pin to this project directory so Next/Turbopack doesn't walk up to the
  // monorepo root and watch sibling apps' node_modules (basic-closet-demo,
  // closet-widget). Using __dirname is safer than process.cwd() because it's
  // independent of where the command is invoked from.
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingRoot: path.join(__dirname),
  // Proxied pages render on tenant hostnames, where /_next belongs to the site
  // renderer — so chunks and optimized images must be absolute back to here.
  ...(useCanonicalAssets ? { assetPrefix: CANONICAL_ORIGIN } : {}),
  images: useCanonicalAssets
    ? { path: `${CANONICAL_ORIGIN}/_next/image` }
    : undefined,
  experimental: {
    // Server actions posted from a proxied tenant hostname carry that host in
    // Origin; without this Next rejects them as cross-origin.
    serverActions: {
      allowedOrigins: ["www.ditchtheform.com", "*.ditchtheform.com"],
    },
  },
  async headers() {
    return [
      {
        // Fonts (and other subresources) are fetched cross-origin once pages
        // are served from a tenant hostname.
        source: "/_next/static/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
        ],
      },
    ]
  },
  // Legacy brand domain → DitchTheForm (login, emails, bookmarks).
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'closetquotes.com' }],
        destination: 'https://www.ditchtheform.com/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.closetquotes.com' }],
        destination: 'https://www.ditchtheform.com/:path*',
        permanent: true,
      },
    ]
  },
  // Mirror intake tier env to the client so landing pricing matches /intake.
  env: {
    NEXT_PUBLIC_INTAKE_TIER_STANDARD_CENTS: process.env.INTAKE_TIER_STANDARD_CENTS,
    NEXT_PUBLIC_INTAKE_TIER_AI_PREMIUM_CENTS: process.env.INTAKE_TIER_AI_PREMIUM_CENTS,
    NEXT_PUBLIC_SITE_MAINTENANCE_MONTHLY_CENTS: process.env.SITE_MAINTENANCE_MONTHLY_CENTS,
    NEXT_PUBLIC_SITE_MAINTENANCE_YEARLY_CENTS: process.env.SITE_MAINTENANCE_YEARLY_CENTS,
    NEXT_PUBLIC_WIDGET_SUBSCRIPTION_MONTHLY_CENTS: process.env.WIDGET_SUBSCRIPTION_MONTHLY_CENTS,
    NEXT_PUBLIC_WIDGET_SUBSCRIPTION_YEARLY_CENTS: process.env.WIDGET_SUBSCRIPTION_YEARLY_CENTS,
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  // No-op source map upload until SENTRY_AUTH_TOKEN is configured.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
