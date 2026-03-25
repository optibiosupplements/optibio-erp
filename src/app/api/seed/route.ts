import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as XLSX from "xlsx";
import * as schema from "@/lib/db/schema";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const sql = neon(url);
  const db = drizzle(sql, { schema });

  try {
    // Check if request has a file upload, otherwise look for local file
    let workbook: XLSX.WorkBook;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      workbook = XLSX.read(buffer, { type: "buffer" });
    } else {
      // Try local data file
      const localPath = join(process.cwd(), "data", "OptiBio_Master_Ingredients_CLEANED.xlsx");
      if (!existsSync(localPath)) {
        return NextResponse.json({
          error: "No file uploaded and data/OptiBio_Master_Ingredients_CLEANED.xlsx not found",
          hint: "POST a multipart form with 'file' field, or place the Excel file in /data/",
        }, { status: 400 });
      }
      const buffer = readFileSync(localPath);
      workbook = XLSX.read(buffer, { type: "buffer" });
    }

    const sheetName = workbook.SheetNames.find(
      (s) => s.toLowerCase().includes("master") || s.toLowerCase().includes("ingredient")
    ) || workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in sheet" }, { status: 400 });
    }

    // Map Excel columns to our schema
    let imported = 0;
    let skipped = 0;
    const batchSize = 50;
    const batches: any[][] = [];
    let currentBatch: any[] = [];

    for (const row of rows) {
      const rmId = row["RM ID"] || row["rm_id"];
      const name = row["Ingredient Name"] || row["ingredient_name"] || row["Name"];
      if (!rmId || !name) { skipped++; continue; }

      const record = {
        rmId: String(rmId).trim(),
        name: String(name).trim(),
        scientificName: row["Scientific Name"] || null,
        category: row["Category"] || "Other",
        subcategory: row["Subcategory"] || null,
        supplierName: row["Supplier"] || null,
        costPerKg: String(row["Cost/Kg ($)"] ?? row["Cost per KG"] ?? row["cost_per_kg"] ?? 0),
        assayPercentage: String(row["Assay (%)"] ?? row["assay_percentage"] ?? 100),
        activeContentPct: String(row["Active Content (%)"] ?? row["active_content_pct"] ?? row["Assay (%)"] ?? 100),
        activeSource: row["Active Source"] ?? null,
        labelClaimActive: (row["Label Claim Active"] ?? "Yes") === "Yes",
        multiComponent: (row["Multi Component"] ?? "No") === "Yes",
        baseOveragePct: String(row["Base Overage (%)"] ?? row["Overage Percentage"] ?? 10),
        baseWastagePct: String(row["Base Wastage (%)"] ?? row["Wastage Percentage"] ?? 3),
        overageCapsule: row["Overage: Capsule"] != null ? String(row["Overage: Capsule"]) : null,
        overageTablet: row["Overage: Tablet"] != null ? String(row["Overage: Tablet"]) : null,
        overagePowder: row["Overage: Powder"] != null ? String(row["Overage: Powder"]) : null,
        overageStickPack: row["Overage: Stick Pack"] != null ? String(row["Overage: Stick Pack"]) : null,
        wastageCapsule: row["Wastage: Capsule"] != null ? String(row["Wastage: Capsule"]) : null,
        wastageTablet: row["Wastage: Tablet"] != null ? String(row["Wastage: Tablet"]) : null,
        wastagePowder: row["Wastage: Powder"] != null ? String(row["Wastage: Powder"]) : null,
        wastageStickPack: row["Wastage: Stick Pack"] != null ? String(row["Wastage: Stick Pack"]) : null,
        functionDesc: row["Function"] ?? null,
        isEstimatedPrice: (row["Supplier"] ?? "").toLowerCase().includes("internal"),
      };

      currentBatch.push(record);
      imported++;

      if (currentBatch.length >= batchSize) {
        batches.push(currentBatch);
        currentBatch = [];
      }
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    // Insert batches
    for (const batch of batches) {
      await db.insert(schema.ingredients).values(batch);
    }

    // Seed capsule sizes
    await db.insert(schema.capsuleSizes).values([
      { size: "3", capacityMg: "200", costPer1000: "5.50" },
      { size: "2", capacityMg: "300", costPer1000: "5.50" },
      { size: "1", capacityMg: "400", costPer1000: "6.00" },
      { size: "0", capacityMg: "500", costPer1000: "6.00" },
      { size: "00", capacityMg: "735", costPer1000: "7.00" },
      { size: "000", capacityMg: "1000", costPer1000: "8.00" },
    ]).onConflictDoNothing();

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      batches: batches.length,
      message: `Successfully imported ${imported} ingredients.`,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
