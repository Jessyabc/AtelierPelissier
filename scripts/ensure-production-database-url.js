/**
 * Ensures `.env.production.local` exists and defines a non-empty DATABASE_URL
 * before running Prisma against production (same URL as Vercel Production).
 */
const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.production.local");

if (!fs.existsSync(envPath)) {
  console.error(
    [
      "Missing .env.production.local",
      "",
      "  1. Copy .env.production.local.example → .env.production.local",
      "  2. Set DATABASE_URL to Vercel → Project → Settings → Environment Variables → Production",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const raw = fs.readFileSync(envPath, "utf8");
const line = raw
  .split(/\r?\n/)
  .find((l) => /^\s*DATABASE_URL\s*=/.test(l) && !/^\s*#/.test(l.trim()));

if (!line) {
  console.error(
    ".env.production.local must contain a line: DATABASE_URL=postgresql://...",
  );
  process.exit(1);
}

let value = line.replace(/^\s*DATABASE_URL\s*=\s*/, "");
const hash = value.indexOf("#");
if (hash !== -1) value = value.slice(0, hash);
value = value.trim().replace(/^["']|["']$/g, "");

if (!value) {
  console.error("DATABASE_URL in .env.production.local is empty.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(value);
} catch {
  console.error(
    "DATABASE_URL must be a full Postgres URL (e.g. postgresql://…@db.….supabase.co:5432/postgres or your provider’s connection string).",
  );
  process.exit(1);
}

const host = parsed.hostname.toLowerCase();
if (!host || host === "host") {
  console.error(
    [
      "DATABASE_URL hostname looks like a placeholder (e.g. literal `host` from an example file).",
      "Paste the real Production DATABASE_URL from Vercel → Settings → Environment Variables.",
      "It must be a real hostname (Supabase, Neon, etc.) — not a placeholder like `host`.",
    ].join("\n"),
  );
  process.exit(1);
}

process.exit(0);
