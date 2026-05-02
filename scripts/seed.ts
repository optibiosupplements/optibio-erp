/**
 * Optibio ERP — master data seed script.
 *
 * Run with:  pnpm seed
 * Or:        bun scripts/seed.ts
 *
 * Reads:
 *   - data/OptiBio_Master_Ingredients_CLEANED.xlsx (canonical, 2,567 rows × 23 cols)
 *   - data/NUTRA_master_ingredient_list_with_supplier_and_prices.xlsx (newer manual data, 514 rows)
 *
 * Inserts into:
 *   - capsule_sizes (6 rows)
 *   - ingredients   (idempotent on rm_id)
 *   - manufacturing_cost_centers (defaults from PRD §FR-7.2)
 *
 * Idempotent: re-running upserts on rm_id. Safe to run multiple times.
 *
 * Loads .env.local automatically when run via `bun` (Bun reads .env.local
 * natively). For pnpm, the script imports dotenv-flow at runtime.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/lib/db/schema";

// Bun reads .env.local natively. For pnpm/node, we manually parse it.
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
if (!isBun && !process.env.DATABASE_URL) {
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
  console.error("❌ DATABASE_URL not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

if (DATABASE_URL.includes("PASTE_YOUR") || DATABASE_URL.includes("USER:PASSWORD")) {
  console.error("❌ DATABASE_URL is still a placeholder. Replace it with your real Neon URL.");
  process.exit(1);
}

const sqlClient = neon(DATABASE_URL);
const db = drizzle(sqlClient, { schema });

// ─────────────────────────────────────────────────────────────────────────────
// Capsule sizes
// ─────────────────────────────────────────────────────────────────────────────

const CAPSULE_SIZES = [
  { size: "3", capacityMg: "200", costPer1000: "5.50" },
  { size: "2", capacityMg: "300", costPer1000: "5.50" },
  { size: "1", capacityMg: "400", costPer1000: "6.00" },
  { size: "0", capacityMg: "500", costPer1000: "6.00" },
  { size: "00", capacityMg: "735", costPer1000: "7.00" },
  { size: "000", capacityMg: "1000", costPer1000: "8.00" },
];

async function seedCapsuleSizes() {
  console.log("→ Seeding capsule_sizes...");
  for (const row of CAPSULE_SIZES) {
    await db.insert(schema.capsuleSizes).values(row).onConflictDoUpdate({
      target: schema.capsuleSizes.size,
      set: { capacityMg: row.capacityMg, costPer1000: row.costPer1000 },
    });
  }
  console.log(`  ✓ ${CAPSULE_SIZES.length} capsule sizes`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Manufacturing cost centers (PRD §FR-7.2)
// ─────────────────────────────────────────────────────────────────────────────

const COST_CENTERS = [
  { name: "Encapsulation Labor", costType: "labor", productFormat: "Capsule", costPerHour: "15.00", notes: "70,000 caps/hour throughput" },
  { name: "Tableting Labor", costType: "labor", productFormat: "Tablet", costPerHour: "15.00", notes: "Standard tablet press" },
  { name: "Blending Labor", costType: "labor", productFormat: null, costPerHour: "15.00", notes: "Pre-encapsulation/tableting blending" },
  { name: "Packaging Labor", costType: "labor", productFormat: null, costPerHour: "15.00", notes: "1,300 bottles/hour throughput" },
  { name: "QA — Batch Testing", costType: "QA", productFormat: null, costPerBatch: "200.00", notes: "Standard COA testing per batch" },
  { name: "Production Waste", costType: "overhead", productFormat: null, costPerUnit: "0.02", notes: "2% standard, 3% for batches under 1,000kg" },
  { name: "Setup / Changeover", costType: "setup", productFormat: null, costPerBatch: "150.00", notes: "Equipment setup and cleaning between batches" },
];

async function seedCostCenters() {
  console.log("→ Seeding manufacturing_cost_centers...");
  // Truncate-and-insert is fine here since cost centers are admin-managed and
  // re-running seed should reset to canonical defaults.
  await db.delete(schema.manufacturingCostCenters);
  for (const row of COST_CENTERS) {
    await db.insert(schema.manufacturingCostCenters).values(row);
  }
  console.log(`  ✓ ${COST_CENTERS.length} cost centers`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingredients — supports both column schemas
// ─────────────────────────────────────────────────────────────────────────────

type IngredientRow = typeof schema.ingredients.$inferInsert;

function pick<T = unknown>(row: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k] as T;
  }
  return undefined;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

function bool(v: unknown, fallback = true): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "yes" || s === "true" || s === "1") return true;
    if (s === "no" || s === "false" || s === "0") return false;
  }
  return fallback;
}

function mapRow(row: Record<string, unknown>): IngredientRow | null {
  const rmId = pick<string | number>(row, "RM ID", "Ingredient ID", "rm_id", "rmId");
  const name = pick<string>(row, "Ingredient Name", "Name", "ingredient_name");
  if (!rmId || !name) return null;

  const supplierName = pick<string>(row, "Supplier", "supplier_name") ?? null;
  const isInternal = supplierName?.toLowerCase().includes("internal") ?? false;

  const assayPercentage = num(pick(row, "Assay (%)", "Assay Percentage", "assay_percentage"), 100);
  const activeContentPct = num(
    pick(row, "Active Content (%)", "active_content_pct", "Assay (%)", "Assay Percentage"),
    assayPercentage,
  );

  return {
    rmId: String(rmId).trim(),
    name: String(name).trim(),
    scientificName: pick<string>(row, "Scientific Name", "scientific_name") ?? null,
    category: pick<string>(row, "Category", "category") ?? "Other",
    subcategory: pick<string>(row, "Subcategory", "subcategory") ?? null,
    supplierName,
    costPerKg: String(num(pick(row, "Cost/Kg ($)", "Current Cost per kg", "Cost per KG", "cost_per_kg"), 0)),
    assayPercentage: String(assayPercentage),
    activeContentPct: String(activeContentPct),
    activeSource: pick<string>(row, "Active Source", "active_source") ?? null,
    labelClaimActive: bool(pick(row, "Label Claim Active", "label_claim_active"), true),
    multiComponent: bool(pick(row, "Multi Component", "Multi-Component", "multi_component"), false),
    baseOveragePct: String(num(pick(row, "Base Overage (%)", "Overage Percentage", "base_overage_pct"), 10)),
    baseWastagePct: String(num(pick(row, "Base Wastage (%)", "Wastage Percentage", "base_wastage_pct"), 3)),
    overageCapsule: pick(row, "Overage: Capsule") != null ? String(num(pick(row, "Overage: Capsule"))) : null,
    overageTablet: pick(row, "Overage: Tablet") != null ? String(num(pick(row, "Overage: Tablet"))) : null,
    overagePowder: pick(row, "Overage: Powder") != null ? String(num(pick(row, "Overage: Powder"))) : null,
    overageStickPack: pick(row, "Overage: Stick Pack") != null ? String(num(pick(row, "Overage: Stick Pack"))) : null,
    wastageCapsule: pick(row, "Wastage: Capsule") != null ? String(num(pick(row, "Wastage: Capsule"))) : null,
    wastageTablet: pick(row, "Wastage: Tablet") != null ? String(num(pick(row, "Wastage: Tablet"))) : null,
    wastagePowder: pick(row, "Wastage: Powder") != null ? String(num(pick(row, "Wastage: Powder"))) : null,
    wastageStickPack: pick(row, "Wastage: Stick Pack") != null ? String(num(pick(row, "Wastage: Stick Pack"))) : null,
    functionDesc: pick<string>(row, "Function", "function_desc") ?? null,
    isEstimatedPrice: isInternal,
  };
}

async function seedIngredientsFromFile(filePath: string, label: string) {
  if (!existsSync(filePath)) {
    console.warn(`  ⚠ ${label} not found at ${filePath} — skipping`);
    return { imported: 0, skipped: 0, updated: 0 };
  }

  console.log(`→ Loading ${label}...`);
  const buffer = readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: "buffer" });

  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes("master")) ??
    wb.SheetNames.find((s) => s.toLowerCase().includes("ingredient")) ??
    wb.SheetNames[0];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
  console.log(`  ${rows.length} rows in "${sheetName}"`);

  let imported = 0;
  let skipped = 0;
  let updated = 0;
  const batch: IngredientRow[] = [];
  const BATCH_SIZE = 100;

  for (const row of rows) {
    const mapped = mapRow(row);
    if (!mapped) {
      skipped++;
      continue;
    }
    batch.push(mapped);
    if (batch.length >= BATCH_SIZE) {
      const { added, refreshed } = await flushBatch(batch);
      imported += added;
      updated += refreshed;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { added, refreshed } = await flushBatch(batch);
    imported += added;
    updated += refreshed;
  }

  console.log(`  ✓ ${imported} new, ${updated} updated, ${skipped} skipped`);
  return { imported, skipped, updated };
}

async function flushBatch(batch: IngredientRow[]): Promise<{ added: number; refreshed: number }> {
  let added = 0;
  let refreshed = 0;
  for (const row of batch) {
    const existing = await db.select({ id: schema.ingredients.id }).from(schema.ingredients).where(eq(schema.ingredients.rmId, row.rmId)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.ingredients).values(row);
      added++;
    } else {
      await db.update(schema.ingredients).set({ ...row, updatedAt: new Date() }).where(eq(schema.ingredients.rmId, row.rmId));
      refreshed++;
    }
  }
  return { added, refreshed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Optibio ERP seed starting...\n");

  // Confirm DB connection
  try {
    const rows = await db.select({ c: sql<number>`COUNT(*)::int` }).from(schema.ingredients);
    const count = rows[0]?.c ?? 0;
    console.log(`✓ Connected. ${count} existing ingredients.\n`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ DB connection failed: ${msg}`);
    console.error(`   Did you run "pnpm db:push" first?`);
    process.exit(1);
  }

  await seedCapsuleSizes();
  await seedCostCenters();

  const dataDir = join(process.cwd(), "data");
  const r1 = await seedIngredientsFromFile(join(dataDir, "OptiBio_Master_Ingredients_CLEANED.xlsx"), "OptiBio_Master_Ingredients_CLEANED.xlsx");
  const r2 = await seedIngredientsFromFile(join(dataDir, "NUTRA_master_ingredient_list_with_supplier_and_prices.xlsx"), "NUTRA_master_ingredient_list (overrides where rm_id matches)");

  console.log("\n🎉 Seed complete.");
  console.log(`   Total: ${r1.imported + r2.imported} new, ${r1.updated + r2.updated} updated, ${r1.skipped + r2.skipped} skipped\n`);
  process.exit(0);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("\n❌ Seed failed:", msg);
  if (e instanceof Error && e.stack) console.error(e.stack);
  process.exit(1);
});
