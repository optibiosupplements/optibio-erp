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
import { agentCalls, appSettings } from "@/lib/db/schema";
import { eq, gte, sql } from "drizzle-orm";

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

// ----------------------------------------------------------------------------
// Hard budget caps. Reads `agent.daily_usd_cap` + `agent.monthly_usd_cap` from
// app_settings. Defaults: $5/day, $50/month. Set "0" to disable a cap.
// ----------------------------------------------------------------------------

export class BudgetExceededError extends Error {
  constructor(public readonly scope: "daily" | "monthly", public readonly spentUsd: number, public readonly capUsd: number) {
    super(`Agent ${scope} budget cap exceeded: $${spentUsd.toFixed(4)} / $${capUsd.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}

const DEFAULT_DAILY_CAP_USD = 5;
const DEFAULT_MONTHLY_CAP_USD = 50;

async function readCap(key: string, fallback: number): Promise<number> {
  try {
    const row = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    if (row.length === 0) return fallback;
    const n = Number(row[0].value);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export interface BudgetStatus {
  todayUsd: number;
  monthUsd: number;
  dailyCapUsd: number;
  monthlyCapUsd: number;
  dailyExceeded: boolean;
  monthlyExceeded: boolean;
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyCap, monthlyCap] = await Promise.all([
    readCap("agent.daily_usd_cap", DEFAULT_DAILY_CAP_USD),
    readCap("agent.monthly_usd_cap", DEFAULT_MONTHLY_CAP_USD),
  ]);

  const [todayRow] = await db
    .select({ total: sql<string>`coalesce(sum(${agentCalls.costUsd}), 0)` })
    .from(agentCalls)
    .where(gte(agentCalls.createdAt, startOfDay));

  const [monthRow] = await db
    .select({ total: sql<string>`coalesce(sum(${agentCalls.costUsd}), 0)` })
    .from(agentCalls)
    .where(gte(agentCalls.createdAt, startOfMonth));

  const todayUsd = Number(todayRow?.total ?? 0);
  const monthUsd = Number(monthRow?.total ?? 0);

  return {
    todayUsd,
    monthUsd,
    dailyCapUsd: dailyCap,
    monthlyCapUsd: monthlyCap,
    dailyExceeded: dailyCap > 0 && todayUsd >= dailyCap,
    monthlyExceeded: monthlyCap > 0 && monthUsd >= monthlyCap,
  };
}

/**
 * Throws BudgetExceededError if today or this month is over the cap.
 * Caller should catch and return a 429.
 *
 * Cheap to call — two indexed sums against `agent_calls.created_at`.
 */
export async function assertWithinBudget(): Promise<void> {
  const status = await getBudgetStatus();
  if (status.dailyExceeded) {
    throw new BudgetExceededError("daily", status.todayUsd, status.dailyCapUsd);
  }
  if (status.monthlyExceeded) {
    throw new BudgetExceededError("monthly", status.monthUsd, status.monthlyCapUsd);
  }
}

