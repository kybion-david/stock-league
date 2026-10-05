// `output: "standalone"` leaves static assets out of .next/standalone.
// Copy them in so the standalone server (and Azure SWA, ADR 009) can serve them.
import { cpSync, existsSync } from "node:fs";

cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });
