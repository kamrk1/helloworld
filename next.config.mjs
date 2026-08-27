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
  webpack: (config, { isServer, webpack }) => {
    if (isServer && hosted.DATABASE_URL) {
      config.plugins.push(
        new webpack.DefinePlugin({
          "process.env.DATABASE_URL": JSON.stringify(process.env.DATABASE_URL ?? ""),
          "process.env.ADMIN_PASSWORD": JSON.stringify(process.env.ADMIN_PASSWORD ?? ""),
          "process.env.SESSION_SECRET": JSON.stringify(process.env.SESSION_SECRET ?? ""),
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
