import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin to this project directory so Next/Turbopack doesn't walk up to the
  // monorepo root and watch sibling apps' node_modules (basic-closet-demo,
  // closet-widget). Using __dirname is safer than process.cwd() because it's
  // independent of where the command is invoked from.
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingRoot: path.join(__dirname),
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

export default nextConfig;
