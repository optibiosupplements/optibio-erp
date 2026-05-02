# Architecture

The "why" of Optibio ERP. For setup and stack, see `CLAUDE.md`. For PRD-level requirements, see `_bmad-output/planning-artifacts/PRD.md`.

## The core flow

```
                                   ┌──────────────┐
            Sales pastes raw text  │              │
            (email body, SF panel) │  Magic Box   │
                  ┌───────────────▶│  /intake/new │
                  │                │              │
                  │                └──────┬───────┘
                  │                       │
                  │            (1) RFQ row created IMMEDIATELY
                  │                status=Draft, RFQ-YYMM-####
                  │                       │
                  │                       ▼
                  │                ┌──────────────┐
                  │                │ Greedy parser│ (2) populate formula JSON
                  │                │ + Eva agent  │     auto-detect format
                  │                └──────┬───────┘     suggest project name
                  │                       │
                  │                       ▼
        Submit to R&D ──────────▶ status=In Review
       (gated on: format set        │
        + ≥1 active ingredient)     ▼
                                 ┌──────────────┐
                                 │   The Lab    │ (3) Danny does Phase 1 sizing
                                 │ /formulations│     → Phase 2 final formula
                                 └──────┬───────┘     creates Formulation row
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │   Pricing    │ (4) RM cost (Active Content %)
                                 │   Engine     │     + Manufacturing + Packaging
                                 │ /quotes/new  │     + 15% Overhead → COGS
                                 └──────┬───────┘     × 3 tiers (2K/5K/10K)
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Quote PDF    │ (5) pdfkit → professional PDF
                                 │ /quotes/[id] │     versioned, status tracked
                                 └──────────────┘

CRM (parallel): Lead → Opportunity → Quote linked through stages.
```

## Domain boundaries

### `src/domains/formulation/`
Pure math. No DB, no UI. Deterministic. Tested.
- `capsule-sizer.ts` — `sizeCapsule(totalFillMg)` → `{capsuleSize, capsulesPerServing, fillPercentage, ...}`. Tries sizes 3→000, capsules 1→6. Refuses if >6 × 1000mg.
- `excipient-calculator.ts` — `calculateExcipients(activeMassMg, targetFillMg, complexity)` → standard/moderate/high SiO₂ + MgSt + MCC filler.
- `knowledge-base.ts` — Static rules: capsule capacities, IU conversions, complexity heuristics.

### `src/domains/pricing/`
Pure math. **Active Content %, not Assay %.**
- `pricing.engine.ts`:
  - `calculateIngredientCost(line)` → cost per unit using `adjustedMg = labelClaim / (activeContent/100); finalMg = adjusted × (1 + overage/100); cost = (final/1M) × costPerKg × (1 + wastage/100)`.
  - `calculateCOGS({ingredients, manufacturing, packaging, overheadPct=15})` → RM + Manuf + Packaging + Overhead.
  - `generateTieredQuote({ingredients, tiers=[2K@40%, 5K@35%, 10K@30%]})` → margin-on-selling-price: `price = COGS / (1 - margin/100)`.
- `pricing.types.ts` — Type definitions for the engine I/O.

### `src/domains/intake/` *(to be created — porting from app26)*
- `ingredient-parser.ts` — Greedy parser. Splits on +/,/newline. Detects ratios (10:1), units (mg/IU/mcg/g/CFU). Active vs Inactive split via "Other Ingredients:" / "Inactive:" delimiters. Fallback: all active.
- `format-detector.ts` — `detectFormat(text)` returns `'CAPSULE' | 'TABLET' | null`. **Powder is detected but flagged as Phase 2.**
- `id-generator.ts` — `generateRfqNumber()` → `RFQ-YYMM-####` (per-month sequence, **not** per-day). The current `/api/intake/route.ts` uses `RFQ-YYYYMMDD-NNN` — to be migrated.

### `src/domains/agents/` *(to be created)*
- `eva.intake.ts` — System prompt for Eva. Loaded by `/api/agent/route.ts`.
- `danny.formulator.ts` — System prompt for Danny. GMP rules, capsule shell default, Phase 1/2 logic.

### `src/lib/db/`
- `schema.ts` — All Drizzle table defs. **Source of truth for the data model.**
- `index.ts` — DB client factory.

### `src/app/(dashboard)/`
Server components by default. Client components only where state is required (intake form, EvaChat, drag-and-drop, modals).

## Key invariants

1. **RFQ creation is non-blocking.** `POST /api/intake` always succeeds and returns an `rfqId` + `rfqNumber`. Parsing happens in a follow-up call (or asynchronously inside the same request, with errors swallowed and surfaced as helper text — never as a blocking error).

2. **Active Content % drives all dosage math.** `assayPercentage` exists on the schema for spec compliance only. Any new pricing or formulation code that touches `assayPercentage` for math is a bug.

3. **Phase 1 dosage forms.** Schema accepts any `dosageForm` text, but the UI selector and Danny only support `Capsule` and `Tablet`. `format-detector.ts` returns `null` for non-supported formats so the user must opt-in manually.

4. **Excipients are derived, not stored as RFQ line items.** The RFQ captures *active* ingredients. Excipients are computed by `excipient-calculator.ts` at formulation time and stored in `formulation_ingredients` with `is_excipient = true`.

5. **CRM is decoupled from RFQ.** An RFQ can exist with no `customerId`. When a customer is later linked, an `opportunities` row is created (or updated) with `stage='RFQ_SUBMITTED'`. Same flow as `supplement-quote-app26`'s `crm.onRfqSubmitted`.

6. **Quote tier margins are configurable, not hardcoded.** Defaults are 2K/40%, 5K/35%, 10K/30% per PRD §FR-3.2. `manufacturingCostCenters` and `packagingMaterials` rows drive the variable side; tier margins are admin-configurable.

7. **Real customer regression tests are the ship gate.** `tests/fixtures/real-customers/` holds Asher Elderberry/Beet/Berberine/Magnesium and Joe Hydration. The Asher Elderberry @ 2K bottles case must match $7.90/bottle ± 10%. Joe Hydration must route to "format not supported."

## Why Next.js 16 (not Vite + tRPC)

`supplement-quote-app26` used Vite + tRPC + Manus.app hosting. We ditched it because:
- Manus is vendor-coupled — exporting Manus-built apps is painful.
- tRPC is great for typesafe RPC but adds a layer that pure Next.js Route Handlers don't need at our scale.
- Next.js 16 server components let us colocate DB queries with the UI that uses them, eliminating a whole class of client/server type mismatches.

Trade-off: we lose some of app26's mature tRPC routes (CRM, single-page workbench). We're porting them as Next.js Route Handlers and Server Actions instead. Pure functions (parser, capsule sizer, excipient calc, pricing engine) port wholesale.

## Why Drizzle (not Prisma)

PRD chose Drizzle for: closer-to-SQL ergonomics, no schema-migration runtime overhead, better Vercel cold-start behavior, smaller bundle. Schema is in pure TS — easy to read, easy to diff in PR review.
