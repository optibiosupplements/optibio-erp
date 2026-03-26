import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { ingredients } from "@/lib/db/schema";
import { ilike, or, sql } from "drizzle-orm";
import { buildAgentPrompt } from "@/domains/formulation/knowledge-base";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Eva — AI Formulation Agent
 *
 * Conversational endpoint that handles:
 * 1. Analyzing extracted SFP data and suggesting formulation adjustments
 * 2. Answering questions about ingredient selection, dosages, capsule sizing
 * 3. Flagging issues (unmatched ingredients, capsule overflow, cost concerns)
 * 4. Recommending optimal ingredient variants based on dosage form
 * 5. Suggesting excipients based on formula complexity
 *
 * Input: { messages: [...], context: { extraction, dosageForm, ... } }
 * Output: { reply: string, suggestions?: [...], flags?: [...] }
 */
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { messages = [], context = {} } = body;

    // Build ingredient context from database if we have extracted ingredients
    let ingredientContext = "";
    if (context.ingredientNames?.length > 0) {
      const relevantIngredients = [];
      for (const name of context.ingredientNames.slice(0, 20)) {
        const cleaned = name.replace(/[®™©]/g, "").trim();
        const results = await db
          .select({
            name: ingredients.name,
            category: ingredients.category,
            supplierName: ingredients.supplierName,
            costPerKg: ingredients.costPerKg,
            activeContentPct: ingredients.activeContentPct,
            assayPct: ingredients.assayPercentage,
            baseOveragePct: ingredients.baseOveragePct,
            overageCapsule: ingredients.overageCapsule,
            overageTablet: ingredients.overageTablet,
            labelClaimActive: ingredients.labelClaimActive,
            multiComponent: ingredients.multiComponent,
            isEstimatedPrice: ingredients.isEstimatedPrice,
          })
          .from(ingredients)
          .where(ilike(ingredients.name, `%${cleaned}%`))
          .limit(5);

        if (results.length > 0) {
          relevantIngredients.push(...results);
        }
      }

      if (relevantIngredients.length > 0) {
        ingredientContext = "Available variants in our database for the requested ingredients:\n\n";
        for (const ing of relevantIngredients) {
          ingredientContext += `- ${ing.name}: $${ing.costPerKg}/kg, Active Content ${ing.activeContentPct}%, Assay ${ing.assayPct}%, Category: ${ing.category}, Supplier: ${ing.supplierName}${ing.isEstimatedPrice ? " (ESTIMATED PRICE)" : ""}\n`;
        }
      }
    }

    // Build system prompt with knowledge base + ingredient context
    const systemPrompt = buildAgentPrompt(ingredientContext);

    // Add context about the current formulation state
    let contextMessage = "";
    if (context.productName) contextMessage += `Product: ${context.productName}\n`;
    if (context.dosageForm) contextMessage += `Dosage Form: ${context.dosageForm}\n`;
    if (context.servingSize) contextMessage += `Serving Size: ${context.servingSize}\n`;
    if (context.servingsPerContainer) contextMessage += `Servings Per Container: ${context.servingsPerContainer}\n`;
    if (context.moq) contextMessage += `MOQ: ${context.moq}\n`;
    if (context.bulkOrPackaged) contextMessage += `Delivery: ${context.bulkOrPackaged}\n`;
    if (context.specialRequirements) contextMessage += `Special Requirements: ${context.specialRequirements}\n`;

    if (context.activeIngredients?.length > 0) {
      contextMessage += "\nActive Ingredients from SFP:\n";
      for (const ing of context.activeIngredients) {
        contextMessage += `- ${ing.name}: ${ing.amount} ${ing.unit}${ing.notes ? ` (${ing.notes})` : ""}${ing.inDb === false ? " [NOT IN DATABASE]" : ""}\n`;
      }
    }
    if (context.excipients?.length > 0) {
      contextMessage += "\nOther Ingredients (Excipients): " + context.excipients.join(", ") + "\n";
    }

    // Build message array for Claude
    const apiMessages: { role: "user" | "assistant"; content: string }[] = [];

    // If we have context, inject it as the first user message
    if (contextMessage) {
      apiMessages.push({
        role: "user",
        content: `Here is the current formulation context:\n\n${contextMessage}\n\nPlease review this formulation. Identify any issues, suggest optimizations, and let me know if you need any clarifications before proceeding. Be specific and actionable.`,
      });
    }

    // Add conversation history
    for (const msg of messages) {
      apiMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    // If no messages at all, add a default
    if (apiMessages.length === 0) {
      apiMessages.push({
        role: "user",
        content: "Hello Eva, I'm starting a new formulation. What information do you need from me?",
      });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: apiMessages,
    });

    const reply = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    return NextResponse.json({
      success: true,
      reply,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
