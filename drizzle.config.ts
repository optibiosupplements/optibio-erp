import type { Config } from "drizzle-kit";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Load .env.local manually — drizzle-kit doesn't read it natively the way Next.js does.
const envPath = join(process.cwd(), ".env.local");
if (!process.env.DATABASE_URL && existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set. Add it to .env.local (see .env.example).");
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
