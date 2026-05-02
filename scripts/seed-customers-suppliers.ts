/**
 * Seed customers + suppliers from real-world data.
 *
 * Customers: real names from `Desktop/0. WORK/1.CUSTOMERS/`
 * Suppliers: extracted from the existing ingredients table, deduped + linked
 *            back via foreign key.
 *
 * Run: pnpm seed:cs
 *
 * Idempotent: re-running upserts on (companyName) for both tables.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql, eq } from "drizzle-orm";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/lib/db/schema";

// .env.local parsing for non-Bun
if (typeof (globalThis as { Bun?: unknown }).Bun === "undefined" && !process.env.DATABASE_URL) {
  const envPath = join(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const sqlClient = neon(DATABASE_URL);
const db = drizzle(sqlClient, { schema });

// ─────────────────────────────────────────────────────────────────────────────
// Customers (from Desktop/0. WORK/1.CUSTOMERS/)
// ─────────────────────────────────────────────────────────────────────────────

const CUSTOMERS = [
  {
    companyName: "Asher Brand (Orzell + KAVA + NEW RFQ)",
    contactName: "Asher",
    tier: "Premium",
    notes: "Active multi-product customer. Capsule line: Sea Moss, Mushroom, Resveratrol, Thyroid, Women's Probiotic (Orzell brand) + KAVA + Elderberry/Beet/Berberine/Magnesium new RFQs.",
    isActive: true,
  },
  {
    companyName: "Joe Seminteli",
    contactName: "Joe",
    tier: "Standard",
    notes: "Hydration Stickpack project (8.5g serving, electrolyte powder). Out of Phase-1 scope (stickpack format).",
    isActive: true,
  },
  {
    companyName: "Lin + Jeremy",
    contactName: "Lin / Jeremy",
    tier: "Standard",
    notes: "ACV Gummy product. Out of Phase-1 scope (gummy format).",
    isActive: true,
  },
  {
    companyName: "HGW",
    contactName: "—",
    tier: "Standard",
    notes: "Horny Goat Weed (Epimedium) capsule project. NPEF format quote on file.",
    isActive: true,
  },
  {
    companyName: "Pedialyte / NBE",
    contactName: "—",
    tier: "Standard",
    notes: "Mentioned in M365 Copilot RFQ. Pediatric electrolyte product.",
    isActive: false,
  },
] as const;

async function seedCustomers(): Promise<number> {
  console.log("→ Seeding customers...");
  let added = 0;
  let updated = 0;
  for (const c of CUSTOMERS) {
    const existing = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.companyName, c.companyName))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(schema.customers)
        .set({ contactName: c.contactName, tier: c.tier, notes: c.notes, isActive: c.isActive, updatedAt: new Date() })
        .where(eq(schema.customers.id, existing[0].id));
      updated++;
    } else {
      await db.insert(schema.customers).values({
        companyName: c.companyName,
        contactName: c.contactName,
        tier: c.tier,
        notes: c.notes,
        isActive: c.isActive,
      });
      added++;
    }
  }
  console.log(`  ✓ ${added} new, ${updated} updated`);
  return added + updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suppliers (extract from ingredients table, dedupe, create supplier rows,
// then back-link ingredients via supplier_id)
// ─────────────────────────────────────────────────────────────────────────────

async function seedSuppliers(): Promise<{ added: number; updated: number; linkedIngredients: number }> {
  console.log("→ Extracting unique suppliers from ingredients...");
  const rows = await db.execute<{ supplier_name: string; ing_count: string }>(sql`
    SELECT supplier_name, COUNT(*)::text as ing_count
    FROM ingredients
    WHERE supplier_name IS NOT NULL
      AND supplier_name <> ''
    GROUP BY supplier_name
    ORDER BY COUNT(*) DESC
  `);

  const uniqueSuppliers = (rows as unknown as { rows: { supplier_name: string; ing_count: string }[] }).rows
    ?? (rows as unknown as { supplier_name: string; ing_count: string }[]);

  console.log(`  Found ${uniqueSuppliers.length} unique supplier names`);

  let added = 0;
  let updated = 0;
  for (const r of uniqueSuppliers) {
    const name = r.supplier_name.trim();
    if (!name) continue;
    const isInternal = name.toLowerCase().includes("internal");
    const note = isInternal
      ? `Placeholder for ingredients with estimated pricing — replace with real supplier when sourced. ${r.ing_count} ingredients use this entry.`
      : `Auto-imported from ingredient master. ${r.ing_count} ingredients sourced from this supplier.`;

    const existing = await db
      .select({ id: schema.suppliers.id })
      .from(schema.suppliers)
      .where(eq(schema.suppliers.companyName, name))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.suppliers)
        .set({ notes: note, isActive: !isInternal, updatedAt: new Date() })
        .where(eq(schema.suppliers.id, existing[0].id));
      updated++;
    } else {
      await db.insert(schema.suppliers).values({
        companyName: name,
        notes: note,
        isActive: !isInternal,
      });
      added++;
    }
  }
  console.log(`  ✓ ${added} new, ${updated} updated`);

  // Back-link ingredients to suppliers via supplier_id
  console.log("→ Back-linking ingredients to suppliers (FK)...");
  const linkResult = await db.execute(sql`
    UPDATE ingredients
    SET supplier_id = s.id
    FROM suppliers s
    WHERE ingredients.supplier_name = s.company_name
      AND ingredients.supplier_id IS NULL
  `);

  const linkedCount = (linkResult as unknown as { rowCount?: number }).rowCount
    ?? (linkResult as unknown as { rowsAffected?: number }).rowsAffected
    ?? 0;
  console.log(`  ✓ ${linkedCount} ingredient → supplier links`);

  return { added, updated, linkedIngredients: linkedCount as number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Customer + Supplier seed starting...\n");

  await seedCustomers();
  await seedSuppliers();

  console.log("\n🎉 Done.\n");
  process.exit(0);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("\n❌ Seed failed:", msg);
  if (e instanceof Error && e.stack) console.error(e.stack);
  process.exit(1);
});
