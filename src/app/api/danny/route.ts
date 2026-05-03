/**
 * POST /api/danny
 *
 * Danny — Bench Formulator API. Loads DANNY_SYSTEM_PROMPT and asks Claude
 * to produce a Phase 1 sizing + Phase 2 final formulation for the given
 * actives.
 *
 * Input: {
 *   actives: [{ name, amount, unit, notes? }],   // user/Magic-Box-parsed actives
 *   dosageForm: "CAPSULE" | "TABLET" | "POWDER", // required
 *   capsuleShell?: "Gelatin" | "HPMC",           // default: Gelatin
 *   servingsPerContainer?: number,
 *   constraints?: string,                        // free text (kosher, halal, etc.)
 * }
 *
 * Output: { reply: string, usage: { inputTokens, outputTokens } }
 *
 * Pure narrative — the deterministic capsule-sizer / excipient-calculator
 * runs on the client (or wherever the form lives) and is shown alongside
 * Danny's prose. They complement, not replace, each other.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { DANNY_SYSTEM_PROMPT } from "@/domains/agents/danny.formulator";
import { logAgentCall, assertWithinBudget, BudgetExceededError } from "@/domains/agents/cost";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ActiveLine {
  name: string;
  amount: string | number;
  unit: string;
  notes?: string;
}

interface PrecomputedFormula {
  totalActiveMg?: number;
  capsuleSize?: string;
  capsulesPerServing?: number;
  totalMgPerCapsule?: number;
  fillPercentage?: number;
  feasible?: boolean;
  warnings?: string[];
  excipients?: Array<{ name: string; mg: number; pct: number; function: string }>;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    await assertWithinBudget();

    const body = await request.json();
    const actives: ActiveLine[] = body.actives ?? [];
    const dosageForm: string = body.dosageForm ?? "";
    const capsuleShell: string = body.capsuleShell ?? "Gelatin";
    const servingsPerContainer: number | undefined = body.servingsPerContainer;
    const constraints: string = body.constraints ?? "";
    const precomputed: PrecomputedFormula | undefined = body.precomputed;

    if (!dosageForm) return NextResponse.json({ error: "dosageForm is required" }, { status: 400 });
    if (actives.length === 0) return NextResponse.json({ error: "at least one active ingredient required" }, { status: 400 });

    const userMessage = buildUserMessage({ actives, dosageForm, capsuleShell, servingsPerContainer, constraints, precomputed });

    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
    const startedAt = Date.now();

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: DANNY_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Fire-and-forget telemetry
    void logAgentCall({
      agentName: "danny",
      action: "bench-formulation",
      model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
      durationMs: Date.now() - startedAt,
      success: true,
      notes: `${actives.length} actives, ${dosageForm}`,
    });

    return NextResponse.json({
      success: true,
      reply,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error: unknown) {
    if (error instanceof BudgetExceededError) {
      return NextResponse.json({ error: error.message, scope: error.scope }, { status: 429 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Danny error:", msg);
    void logAgentCall({
      agentName: "danny",
      action: "bench-formulation",
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      usage: { inputTokens: 0, outputTokens: 0 },
      success: false,
      notes: msg.slice(0, 200),
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildUserMessage(args: {
  actives: ActiveLine[];
  dosageForm: string;
  capsuleShell: string;
  servingsPerContainer?: number;
  constraints: string;
  precomputed?: PrecomputedFormula;
}): string {
  const lines: string[] = [];
  lines.push(`Dosage form: ${args.dosageForm}`);
  if (args.dosageForm === "CAPSULE") lines.push(`Capsule shell preference: ${args.capsuleShell}`);
  if (args.servingsPerContainer) lines.push(`Servings per container: ${args.servingsPerContainer}`);
  if (args.constraints) lines.push(`Constraints: ${args.constraints}`);
  lines.push("");
  lines.push("Active ingredients (label claim per serving):");
  for (const a of args.actives) {
    const note = a.notes ? ` — ${a.notes}` : "";
    lines.push(`- ${a.name}: ${a.amount} ${a.unit}${note}`);
  }
  lines.push("");

  if (args.precomputed && args.precomputed.feasible !== false) {
    // Math is already computed deterministically. Danny is enrichment, not source of truth.
    lines.push("DETERMINISTIC FORMULA (already computed — DO NOT recompute, only annotate):");
    if (args.precomputed.totalActiveMg !== undefined) lines.push(`- Total active mass per serving: ${args.precomputed.totalActiveMg} mg`);
    if (args.precomputed.capsuleSize) lines.push(`- Capsule size: ${args.precomputed.capsuleSize}`);
    if (args.precomputed.capsulesPerServing) lines.push(`- Capsules per serving: ${args.precomputed.capsulesPerServing}`);
    if (args.precomputed.totalMgPerCapsule !== undefined) lines.push(`- Fill weight per capsule: ${args.precomputed.totalMgPerCapsule} mg`);
    if (args.precomputed.fillPercentage !== undefined) lines.push(`- Fill %: ${args.precomputed.fillPercentage.toFixed(1)}%`);
    if (args.precomputed.excipients?.length) {
      lines.push("- Excipients:");
      for (const ex of args.precomputed.excipients) {
        lines.push(`  • ${ex.name}: ${ex.mg.toFixed(1)} mg (${ex.pct.toFixed(2)}%) — ${ex.function}`);
      }
    }
    if (args.precomputed.warnings?.length) {
      lines.push("- Warnings: " + args.precomputed.warnings.join("; "));
    }
    lines.push("");
    lines.push("Your job: write the manufacturer-facing rationale (excipient choices, processing notes, regulatory flags, label notes) for this formula. Do NOT change the capsule size, count, or excipient quantities — they are locked. Reference them and explain why they are sound. Flag any manufacturability risks (poor flow, hygroscopic, sticky, high botanical, low bulk density).");
  } else {
    lines.push("Please produce: (1) Phase 1 sizing recommendation, (2) Phase 2 final bench formulation, and (3) any manufacturability flags. Use the output format from your system prompt.");
  }

  return lines.join("\n");
}
