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
};

export default nextConfig;
