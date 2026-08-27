import { existsSync, readFileSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

if (existsSync("hosted.json")) {
  const hosted = JSON.parse(readFileSync("hosted.json", "utf8"));
  for (const [key, value] of Object.entries(hosted)) {
    if (typeof value === "string" && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadEnvFile(".env.local");

const stub = `/** Filled at production build from hosted.json. Keep empty in git. */
export const HOSTED: {
  DATABASE_URL?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
} = {};
`;

function writeHostedValues() {
  const db = process.env.DATABASE_URL || "";
  const pw = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.SESSION_SECRET || "";
  if (!db) return;
  const src = `/** Generated at build. Do not commit secrets. */
export const HOSTED = {
  DATABASE_URL: ${JSON.stringify(db)},
  ADMIN_PASSWORD: ${JSON.stringify(pw)},
  SESSION_SECRET: ${JSON.stringify(secret)},
};
`;
  writeFileSync("src/lib/hosted-values.ts", src);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: process.cwd(), env: process.env });
  if (result.status !== 0) {
    writeFileSync("src/lib/hosted-values.ts", stub);
    process.exit(result.status ?? 1);
  }
}

writeHostedValues();
try {
  run("npx", ["prisma", "generate"]);
  run("npx", ["prisma", "migrate", "deploy"]);
  run("npx", ["prisma", "db", "seed"]);
  run("npx", ["next", "build"]);
} finally {
  writeFileSync("src/lib/hosted-values.ts", stub);
}
