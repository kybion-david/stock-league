import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone; keeps the deploy under Azure
  // SWA's 250 MB app limit (ADR 009).
  output: "standalone",
  // Demo season (ADR 020): on in every Next build until the demo PR is
  // reverted. `STOCK_LEAGUE_DEMO=0 npm run dev` uses the real database.
  env: { STOCK_LEAGUE_DEMO: process.env.STOCK_LEAGUE_DEMO ?? "1" },
  // Demo mode runs PGlite in the server; load it from node_modules (it reads
  // its own .wasm and .data files) and ship those and the migrations.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/**": [
      "./db/migrations/*.sql",
      "./node_modules/@electric-sql/pglite/dist/*.{js,cjs,wasm,data}",
    ],
  },
};

export default nextConfig;
