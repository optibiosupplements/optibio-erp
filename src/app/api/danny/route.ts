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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ActiveLine {
  name: string;
  amount: string | number;
  unit: string;
  notes?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await request.json();
    const actives: ActiveLine[] = body.actives ?? [];
    const dosageForm: string = body.dosageForm ?? "";
    const capsuleShell: string = body.capsuleShell ?? "Gelatin";
    const servingsPerContainer: number | undefined = body.servingsPerContainer;
    const constraints: string = body.constraints ?? "";

    if (!dosageForm) return NextResponse.json({ error: "dosageForm is required" }, { status: 400 });
    if (actives.length === 0) return NextResponse.json({ error: "at least one active ingredient required" }, { status: 400 });

    const userMessage = buildUserMessage({ actives, dosageForm, capsuleShell, servingsPerContainer, constraints });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: DANNY_SYSTEM_PROMPT,
          // Cache the long system prompt — Anthropic prompt caching cuts cost on repeat calls.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

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
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Danny error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildUserMessage(args: {
  actives: ActiveLine[];
  dosageForm: string;
  capsuleShell: string;
  servingsPerContainer?: number;
  constraints: string;
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
  lines.push("Please produce: (1) Phase 1 sizing recommendation, (2) Phase 2 final bench formulation, and (3) any manufacturability flags. Use the output format from your system prompt.");
  return lines.join("\n");
}
