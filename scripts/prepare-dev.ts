import { copyFileSync, existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const envLocal = path.join(root, ".env.local");
const examplePath = path.join(root, ".env.example");

if (!existsSync(envPath) && existsSync(examplePath)) {
  copyFileSync(examplePath, envPath);
  console.log("Created .env from .env.example — set ADMIN_PASSWORD in .env.local for a custom login.");
}

function loadEnvFile(filePath: string) {
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

loadEnvFile(envPath);
loadEnvFile(envLocal);

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./clinic.db";
}

function isPostgres(url = process.env.DATABASE_URL || "") {
  return /^(postgres(ql)?|prisma\+postgres):/i.test(url);
}

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: root, env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "generate", "--schema", "prisma/cloud/schema.prisma"]);

if (isPostgres()) {
  console.log("Using hosted Postgres (DATABASE_URL). This is the live clinic database.");
  run("npx", ["prisma", "migrate", "deploy", "--schema", "prisma/cloud/schema.prisma"]);
} else {
  console.log("Using local SQLite — no cloud credentials required.");
  run("npx", ["prisma", "migrate", "deploy"]);
}
run("npx", ["prisma", "db", "seed"]);
