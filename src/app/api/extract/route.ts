import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { ingredients } from "@/lib/db/schema";
import { ilike, or, sql } from "drizzle-orm";
import { parseIngredients } from "@/domains/intake/ingredient-parser";
import { detectFormat } from "@/domains/intake/format-detector";
import { assertWithinBudget, BudgetExceededError } from "@/domains/agents/cost";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert nutraceutical formulation analyst. Extract ALL information from supplement facts panels.

Return ONLY valid JSON with this exact structure:
{
  "productName": "full product name",
  "dosageForm": "tablet" | "capsule" | "powder" | "softgel" | "gummy",
  "servingSize": number (e.g., 1),
  "servingSizeUnit": "tablet" | "capsule" | "scoop" etc.,
  "servingsPerContainer": number,
  "flavor": "flavor if mentioned" | null,
  "activeIngredients": [
    {
      "name": "ingredient name exactly as shown",
      "amount": number (in mg),
      "unit": "mg" | "mcg" | "g" | "IU" | "CFU" | "billion CFU",
      "percentDV": "% daily value if shown" | null,
      "notes": "any qualifier like '5 Billion CFU' etc." | null
    }
  ],
  "otherIngredients": ["Mannitol", "Xylitol", etc.],
  "allergenInfo": "allergen statement if present" | null,
  "brandedIngredients": ["DigeZyme®", etc.],
  "warnings": "warning text" | null
}

Rules:
- Convert ALL amounts to mg (1g = 1000mg, 1mcg = 0.001mg, 1IU vitamin D3 ≈ 0.025mcg)
- Keep original units in the "unit" field for reference
- Include the mg-equivalent amount in "amount" field
- For probiotics, put CFU count in notes and mg weight in amount
- Extract OTHER INGREDIENTS list completely
- Identify branded/trademarked ingredients (®, ™)`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textInput = formData.get("text") as string | null;

    if (!file && !textInput) {
      return NextResponse.json({ error: "Provide a file or text input" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    let extractedData: any;

    if (file) {
      // Vision is the only LLM-bearing branch in this route.
      await assertWithinBudget();
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mimeType = file.type || "application/pdf";

      if (mimeType.startsWith("image/")) {
        // Image — send directly to vision
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType as any, data: base64 } },
              { type: "text", text: "Extract the complete supplement facts panel from this image. Return JSON only." },
            ],
          }],
        });
        extractedData = parseAIResponse(response);
      } else if (mimeType === "application/pdf") {
        // PDF — use document support
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: "Extract the complete supplement facts panel from this PDF. Return JSON only." },
            ],
          }],
        });
        extractedData = parseAIResponse(response);
      } else {
        return NextResponse.json({ error: `Unsupported file type: ${mimeType}. Use PDF, PNG, or JPG.` }, { status: 400 });
      }
    } else if (textInput) {
      // Plain text — use the deterministic parser instead of an LLM call.
      // Equivalent extraction, zero token cost, deterministic output.
      const parsed = parseIngredients(textInput);
      const fmt = detectFormat(textInput);
      extractedData = {
        productName: null,
        dosageForm: fmt.format && fmt.isSupported ? String(fmt.format).toLowerCase() : null,
        servingSize: null,
        servingSizeUnit: null,
        servingsPerContainer: null,
        flavor: null,
        activeIngredients: parsed.filter((p) => p.isActive).map((p) => ({
          name: p.name,
          amount: p.amount ? Number(p.amount) : null,
          unit: p.unit || "mg",
          percentDV: null,
          notes: p.notes || null,
        })),
        otherIngredients: parsed.filter((p) => !p.isActive).map((p) => p.name),
        allergenInfo: null,
        brandedIngredients: [],
        warnings: fmt.warning ?? null,
      };
    }

    if (!extractedData) {
      return NextResponse.json({ error: "Failed to extract data from input" }, { status: 400 });
    }

    // Match extracted ingredients against our database
    const matchedIngredients = [];

    for (const ing of extractedData.activeIngredients || []) {
      const matches = await findBestMatch(ing.name);
      matchedIngredients.push({
        ...ing,
        dbMatch: matches.length > 0 ? matches[0] : null,
        alternatives: matches.slice(1, 4),
      });
    }

    // Also try to match other ingredients (excipients)
    const matchedExcipients = [];
    for (const name of extractedData.otherIngredients || []) {
      const matches = await findBestMatch(name);
      matchedExcipients.push({
        name,
        amount: null, // excipient amounts not on label
        dbMatch: matches.length > 0 ? matches[0] : null,
      });
    }

    return NextResponse.json({
      success: true,
      extracted: extractedData,
      matchedIngredients,
      matchedExcipients,
    });
  } catch (error: any) {
    if (error instanceof BudgetExceededError) {
      return NextResponse.json({ error: error.message, scope: error.scope }, { status: 429 });
    }
    console.error("Extract error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function findBestMatch(name: string) {
  const cleaned = name
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Try exact-ish match first
  let results = await db
    .select({
      id: ingredients.id,
      rmId: ingredients.rmId,
      name: ingredients.name,
      category: ingredients.category,
      supplierName: ingredients.supplierName,
      costPerKg: ingredients.costPerKg,
      activeContentPct: ingredients.activeContentPct,
      baseOveragePct: ingredients.baseOveragePct,
      baseWastagePct: ingredients.baseWastagePct,
      overageCapsule: ingredients.overageCapsule,
      overageTablet: ingredients.overageTablet,
      wastageCapsule: ingredients.wastageCapsule,
      wastageTablet: ingredients.wastageTablet,
      isEstimatedPrice: ingredients.isEstimatedPrice,
      labelClaimActive: ingredients.labelClaimActive,
    })
    .from(ingredients)
    .where(ilike(ingredients.name, `%${cleaned}%`))
    .limit(5);

  // If no results, try individual words
  if (results.length === 0) {
    const words = cleaned.split(" ").filter((w) => w.length > 3);
    for (const word of words) {
      results = await db
        .select({
          id: ingredients.id,
          rmId: ingredients.rmId,
          name: ingredients.name,
          category: ingredients.category,
          supplierName: ingredients.supplierName,
          costPerKg: ingredients.costPerKg,
          activeContentPct: ingredients.activeContentPct,
          baseOveragePct: ingredients.baseOveragePct,
          baseWastagePct: ingredients.baseWastagePct,
          overageCapsule: ingredients.overageCapsule,
          overageTablet: ingredients.overageTablet,
          wastageCapsule: ingredients.wastageCapsule,
          wastageTablet: ingredients.wastageTablet,
          isEstimatedPrice: ingredients.isEstimatedPrice,
          labelClaimActive: ingredients.labelClaimActive,
        })
        .from(ingredients)
        .where(ilike(ingredients.name, `%${word}%`))
        .limit(5);
      if (results.length > 0) break;
    }
  }

  return results;
}

function parseAIResponse(response: any): any {
  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  // Extract JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
