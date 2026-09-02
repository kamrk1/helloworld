/**
 * Prepare a Cloudflare Workers / OpenNext build:
 * generate the Postgres Prisma client into the default @prisma/client location
 * (no custom `output`) so OpenNext can patch it for workerd.
 *
 * Local `npm run dev` still generates SQLite into @prisma/client via prepare-dev.ts.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

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
loadEnvFile(".env");

process.env.OPEN_NEXT = "1";
process.env.NEXTJS_ENV = process.env.NEXTJS_ENV || "production";

const cloudSchema = readFileSync("prisma/cloud/schema.prisma", "utf8");
const workersSchema = cloudSchema
  .replace(/\s*output\s*=\s*"[^"]+"/, "")
  .replace(/\s*binaryTargets\s*=\s*\[[^\]]*\]/, "");

const workersPath = join(root, "prisma/cloud/schema.workers.prisma");
mkdirSync(dirname(workersPath), { recursive: true });
writeFileSync(workersPath, workersSchema);

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: root, env: process.env, shell: process.platform === "win32" });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate", "--schema", "prisma/cloud/schema.workers.prisma"]);

const db = process.env.DATABASE_URL || "";
if (/^(postgres(ql)?|prisma\+postgres):/i.test(db)) {
  console.log("Applying Prisma Postgres migrations (cloud schema)…");
  const migrate = spawnSync(
    "npx",
    ["prisma", "migrate", "deploy", "--schema", "prisma/cloud/schema.prisma"],
    { stdio: "inherit", cwd: root, env: process.env, shell: process.platform === "win32" },
  );
  if (migrate.status !== 0) {
    console.warn("Cloud migrate failed — continuing OpenNext build. Set DATABASE_URL to a reachable Postgres URL.");
  }
} else {
  console.warn(
    "No Postgres DATABASE_URL in the build env. The Worker still needs wrangler secrets at runtime:\n" +
      "  DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET, PLATFORM_PASSWORD\n" +
      "  Optional: CLINIC_PASSWORD_PEPPER (same value on every host that hashes clinic passwords)",
  );
}

console.log("Prisma client generated for Cloudflare Workers (driver adapters, default @prisma/client).");
