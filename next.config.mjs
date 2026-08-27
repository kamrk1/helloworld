import { existsSync, readFileSync } from "fs";

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
  output: "standalone",
  transpilePackages: [
    "@fullcalendar/core",
    "@fullcalendar/react",
    "@fullcalendar/timegrid",
    "@fullcalendar/interaction",
    "@fullcalendar/luxon3",
  ],
};

export default nextConfig;
