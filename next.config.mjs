import { existsSync, readFileSync } from "fs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const hosted = existsSync("./hosted.json")
  ? JSON.parse(readFileSync("./hosted.json", "utf8"))
  : {};

for (const [key, value] of Object.entries(hosted)) {
  if (typeof value === "string" && value && !process.env[key]) {
    process.env[key] = value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.STANDALONE_OUTPUT === "1" ? { output: "standalone" } : {}),
  transpilePackages: [
    "@fullcalendar/core",
    "@fullcalendar/react",
    "@fullcalendar/timegrid",
    "@fullcalendar/interaction",
    "@fullcalendar/luxon3",
  ],
  experimental: {
    outputFileTracingIncludes: {
      "/**": ["./src/generated/cloud/**/*"],
    },
    serverComponentsExternalPackages: [
      "@prisma/client",
      ".prisma/client",
      "@prisma/adapter-pg",
      "pg",
    ],
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/manifest.webmanifest",
      headers: [{ key: "Content-Type", value: "application/manifest+json" }],
    },
  ],
};

export default nextConfig;

try {
  initOpenNextCloudflareForDev();
} catch (err) {
  console.warn("OpenNext Cloudflare dev init skipped:", err instanceof Error ? err.message : err);
}
