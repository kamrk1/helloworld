import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";

if (existsSync("hosted.json")) {
  const hosted = JSON.parse(readFileSync("hosted.json", "utf8")) as Record<string, unknown>;
  for (const [key, value] of Object.entries(hosted)) {
    if (typeof value === "string" && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: process.cwd(), env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "db", "seed"]);
run("npx", ["next", "build"]);
