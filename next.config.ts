import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone; keeps the deploy under Azure
  // SWA's 250 MB app limit (ADR 009).
  output: "standalone",
};

export default nextConfig;
