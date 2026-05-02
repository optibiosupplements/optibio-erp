/**
 * Anthropic API cost calculator + persistence helper.
 *
 * Prices reflect Anthropic's published rates as of May 2026 ($/MTok).
 * Cache writes cost more than base input; cache reads cost less.
 *
 * Update this table when Anthropic publishes new pricing. The pricing snapshot
 * is intentionally inline (rather than env-driven) so the historical
 * agent_calls.cost_usd values remain auditable against the same model + rate.
 */

import { db } from "@/lib/db";
import { agentCalls } from "@/lib/db/schema";

interface ModelPricing {
  input: number;            // $/MTok base input
  cacheWrite: number;       // $/MTok cache creation
  cacheRead: number;        // $/MTok cache read
  output: number;           // $/MTok output
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude Opus 4.7 — May 2026 pricing
  "claude-opus-4-7":            { input: 15.00, cacheWrite: 18.75, cacheRead: 1.50, output: 75.00 },
  "claude-opus-4-7[1m]":        { input: 30.00, cacheWrite: 37.50, cacheRead: 3.00, output: 150.00 },
  // Claude Sonnet 4.6
  "claude-sonnet-4-6":           { input: 3.00,  cacheWrite: 3.75,  cacheRead: 0.30, output: 15.00 },
  // Older models that might still be referenced
  "claude-sonnet-4-20250514":    { input: 3.00,  cacheWrite: 3.75,  cacheRead: 0.30, output: 15.00 },
  // Haiku 4.5
  "claude-haiku-4-5-20251001":   { input: 1.00,  cacheWrite: 1.25,  cacheRead: 0.10, output: 5.00 },
};

const DEFAULT_PRICING: ModelPricing = MODEL_PRICING["claude-sonnet-4-6"];

export interface UsageBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export function computeCostUsd(model: string, usage: UsageBreakdown): number {
  const p = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const cost =
    (usage.inputTokens / 1_000_000) * p.input +
    (usage.outputTokens / 1_000_000) * p.output +
    ((usage.cacheCreationTokens ?? 0) / 1_000_000) * p.cacheWrite +
    ((usage.cacheReadTokens ?? 0) / 1_000_000) * p.cacheRead;
  return Math.round(cost * 1_000_000) / 1_000_000;  // round to micro-dollars
}

export interface LogCallArgs {
  agentName: string;
  action?: string;
  model: string;
  usage: UsageBreakdown;
  durationMs?: number;
  success?: boolean;
  relatedTable?: string;
  relatedId?: string;
  notes?: string;
}

/**
 * Persist a single agent call. Fire-and-forget — never throws to the caller
 * (logging failures shouldn't break the agent response).
 */
export async function logAgentCall(args: LogCallArgs): Promise<void> {
  try {
    const cost = computeCostUsd(args.model, args.usage);
    await db.insert(agentCalls).values({
      agentName: args.agentName,
      action: args.action ?? null,
      model: args.model,
      inputTokens: args.usage.inputTokens,
      outputTokens: args.usage.outputTokens,
      cacheCreationTokens: args.usage.cacheCreationTokens ?? 0,
      cacheReadTokens: args.usage.cacheReadTokens ?? 0,
      costUsd: String(cost),
      durationMs: args.durationMs ?? null,
      success: args.success ?? true,
      relatedTable: args.relatedTable ?? null,
      relatedId: args.relatedId ?? null,
      notes: args.notes ?? null,
    });
  } catch (e: unknown) {
    // Never throw — agent should succeed even if telemetry fails.
    console.error("agent call log failed:", e instanceof Error ? e.message : String(e));
  }
}
