# Dead Repos — Salvage Report

Produced 2026-05-03, **revised 2026-05-03 (round 2)** to include the 4 repos initially deferred. **All 11 dead repos have now been mined.** Repos cloned shallow to `/tmp/dead-repos/`. Delete with `rm -rf /tmp/dead-repos` after porting what you want.

---

## Recommended ports (ranked by value)

| # | Source | Port to | Why |
|---|---|---|---|
| 1 | `panna-farm-hub-v2/supabase/functions/_shared/excipient-map.json` (851 lines) | `optibio-erp/data/excipient-map.json` + new seed in `scripts/seed-excipients.ts` | **Fully populated 30+ excipient master** — matches NUTRA ERP's `EXCIPIENT_MAP_v2025-10-28.xlsx` but in JSON. Has standard_name, aliases, function, format_applicability, recommended_percent_range, processing_flags, regulatory_flags, moisture_sensitivity, particle_size. Powers Danny's excipient calculator and Eva's substitution suggestions. |
| 2 | `panna-farm-hub-v2/supabase/functions/_shared/ingredient-synonyms.json` (250 lines) | `optibio-erp/data/ingredient-synonyms.json` + new column or table | Canonical name → aliases. Lets the parser match "Vit C", "Ascorbic Acid", "Ascorbate" to one ingredient row. Fixes the ~15% match-failure rate we see in /api/extract today. |
| 3 | `Quote/airtable_ingredients_import.csv` | Field migration on `ingredients` table | Adds 5 fields the current schema lacks: **Regulatory Status, Allergen Information, Storage Requirements, Shelf Life (Months), Cost Range Min/Max**. Real data we already cleaned for an Airtable build that never shipped. |
| 4 | `Quote/comprehensive_formulation_database.json` (674 lines) | `optibio-erp/data/formulation-templates.json` + new `formulation_templates` table | Pre-built formulation patterns (immune, energy, sleep, joint, etc.) with active+excipient blueprints. Speeds up Eva's "suggest similar formulas" flow. |
| 5 | `supplement-quote-system/server/services/costingEngine.ts` (174 LOC) | Reference only — diff against `src/domains/pricing/pricing.engine.ts` | Different costing approach; may surface margin/overhead corner cases we missed. **Don't replace, compare.** |
| 6 | `panna-farm-hub-v2/costing_app_implementation_guide.md` + `costing_app_erd.png` | `optibio-erp/docs/reference/` | Architectural rationale and ERD for the costing module. Useful when extending pricing engine for stickpacks/gummies in Phase 2. |
| 7 | `Quote/Final_Master_Costing_Sheet (1).xlsx`, `RM_compounds and compositions.xlsx`, `Film_and_Bag_Cost_Calculator.xlsx`, `7.4 Updated Quote Template.xlsx` | `optibio-erp/data/reference/` (read-only) | The original Excel quotes that drove all this. Already partially mirrored in `Desktop/Quotation/`. Keep as ground truth for pricing calibration. |
| 8 | `void-create-spark/supabase/migrations/20251107000000_crm_module.sql` (533 LOC) | Reference only — diff against current `customers`, `opportunities`, new `lead_sources` table | Adds **lead sources** as first-class entities (trade_show, referral, cold_outreach, etc.) with `cost_per_lead` tracking. Adds `company_size` and `annual_revenue` enums to leads. Adds explicit `activities` audit log. Worth ~1 hour to compare and lift the lead-source table. |
| 9 | `Quote/airtable_suppliers_import.csv` | Field migration on `suppliers` table | Adds supplier metadata our schema doesn't have: contact name/title, payment terms, lead time, MOQ. Already-cleaned real data. |
| 10 | `adv-supp-frontend/src/components/QuoteBuilder.jsx` + `FormulationBuilder.jsx` | Reference only | Earlier React component patterns. Skim for UX flows, don't lift the code (older deps). |

---

## Per-repo findings

### supplement-quote-system (1.6 MB / 72 files)

The largest dead repo. Built around a Drizzle + Express stack with **four schema variants** (`schema.ts`, `schema-erp.ts`, `schema-old.ts`, `schema-enhanced.ts`) — evidence of churn during a major rebuild. Has `server/services/costingEngine.ts` (174 LOC) and `server/costCalculator.ts` (321 LOC), an `ai_formulation_test_results.json` with empirical test data, and `data/prepared/ingredients.json`. Most of the schemas overlap heavily with what optibio-erp already has — but `schema-enhanced.ts` (255 LOC) may have CRM tables or accounting fields we don't. Worth a one-hour diff before discarding. The `agents/` directory contains earlier prompt iterations.

**Lift:** None directly — schema is older. Read `costingEngine.ts` to compare against our pricing engine.

### pannas-erp (408 KB / 18 files)

A Next.js + Drizzle + Railway attempt from 2025-10-25. Has `data/consolidated_ingredients_suppliers.csv` (the same join we're already using in optibio-erp), `lib/db/schema.ts` with traditional ERP tables (customers/suppliers/manufacturers/formulations/ingredients/accounting), one migration `0001_pink_jimmy_woo.sql`, and `scripts/add-ingredient-synonyms.ts` (which references the synonyms JSON below).

**Lift:** None — superseded by optibio-erp. Useful only as comparison for the synonym-loading script pattern.

### panna-farm-hub-v2 (1.4 MB / 32 files) — **GOLD MINE**

Lovable.dev / Supabase build. Most valuable single repo because it contains **two production-grade JSON datasets** the current optibio-erp lacks:

- `supabase/functions/_shared/excipient-map.json` — 851 lines, 30+ excipients with full metadata (function, format applicability, recommended % range, processing flags, regulatory flags, moisture sensitivity, particle size). This is the canonical excipient master Eva and Danny should be reasoning over. Currently we hard-code 3 standard excipients (SiO₂, Mg Stearate, MCC) in `excipient-calculator.ts`. With this map, Eva can suggest format-specific alternatives.
- `supabase/functions/_shared/ingredient-synonyms.json` — 250 lines mapping canonical ingredient names to alias lists. Solves the matching problem in `/api/extract`'s `findBestMatch` (currently ILIKE only, misses brand variations).

Also: `costing_schema_migration.sql`, `costing_app_implementation_guide.md`, `costing_app_erd.png/.mmd`, `bmad/artifacts/phase1-analysis/` (their BMAD output for comparison with ours), and `spreadsheet_templates/06_ingredient_components.csv`.

**Lift:** Items 1, 2, 4, 6 from the recommended-ports table.

### panna-farm-hub (911 KB / 19 files)

Predecessor to v2. Same Supabase functions directory with the same `excipient-map.json` and `ingredient-synonyms.json`. Compare line counts to see if v2 is strictly newer (it appears to be — same files, smaller v1 versions of some).

**Lift:** None — v2 supersedes.

### Quote (3.2 MB / 19 files)

Mostly an Airtable + Excel reference build, not running code. Contains:
- 12 PDFs documenting an Airtable automation strategy (skim the build guide for ideas; do not implement)
- **`airtable_ingredients_import.csv`** — extended ingredient fields including `Regulatory Status`, `Allergen Information`, `Storage Requirements`, `Shelf Life (Months)`, `Cost Range Min/Max`, `Last Price Update`. **These columns are not in our current `ingredients` schema** and are real, populated data.
- `airtable_suppliers_import.csv` — supplier records with similar enriched fields
- **`comprehensive_formulation_database.json`** (674 lines) — pre-canned formulation templates
- Excel masters: `Final_Master_Costing_Sheet (1).xlsx`, `RM_compounds and compositions.xlsx`, `Film_and_Bag_Cost_Calculator.xlsx`, `7.4 Updated Quote Template.xlsx`, `Film_Suppliers.xlsx`, `Film_and_Bag_Cost Calculator_Template.xltx`
- `create_formulation_database_schema.py` — Python schema script (reference only)

**Lift:** Items 3, 4, 7 from the recommended-ports table.

### supplement-quotation-system (933 KB / 2 files)

Just contains a single archived Excel file (`Final_Master_Costing_Sheet .xlsx`) and a README. The big size is the binary. Already mirrored in `Desktop/Quotation/` and `Quote` repo above. Skip.

**Lift:** None.

---

## Round 2 — additional repos mined

### void-create-spark (197 KB / 19 files)

Vite + Supabase + React. Despite the throw-away name, contains the **most sophisticated CRM schema of any dead repo** — `supabase/migrations/20251107000000_crm_module.sql` is 533 lines defining `lead_sources`, `leads`, `contacts`, `activities` with rich metadata: `company_size` enum (1-10 / 11-50 / 51-200 / 201-500 / 501-1000 / 1000+), `annual_revenue` enum, `lead_status` workflow, lead source `cost_per_lead` for ROI tracking. Also has `CRM_DEPLOYMENT_GUIDE.md` and modern UI components (`ModernNavigation`, `ModernStatsCard`, `ModernPageHeader`).

**Lift:** Recommended port #8. Specifically, add a `lead_sources` table to track where each customer came from with cost-per-lead. Useful when sales asks "what's our trade-show ROI?"

### adv-supp-frontend (121 KB / 13 files)

Vite + JSX (not TypeScript) deployed to Vercel. Has 5 main components: `QuoteBuilder.jsx`, `FormulationBuilder.jsx`, `IngredientsManager.jsx`, `CustomersManager.jsx`, `Dashboard.jsx`. Plus a complete shadcn/ui set (radix primitives, dialog, command, etc.) and `src/data/ingredients.js` (likely a JS export of the master list). The components are likely older versions of what we already built better.

**Lift:** None — reference only. Skim the QuoteBuilder UX if you want to compare flows.

### advanced-supplements-dashboard (21 KB / 5 files)

Plain HTML + CSS + JS — `index.html`, `styles.css`, `script.js`. Looks like a static dashboard mockup, not a real app. Single-page wireframe.

**Lift:** None — purely a visual mockup, not code.

### adv-supp-flask-api (18 KB / 7 files)

Python Flask backend with SQLAlchemy models for `User`, `Quotation`, `Ingredient`, `Supplier`. The `Quotation` model defines a `QuotationStatus` enum (DRAFT / PENDING / APPROVED / REJECTED / EXPIRED) and a `calculate_totals()` method using `margin_multiplier = 1 + (margin_percentage / 100)` — note this is **margin-on-cost**, our current engine uses margin-on-selling-price (`price = cogs / (1 - margin/100)`). Different stack, different math model.

**Lift:** None — different language and a different margin philosophy. Reference only.

---

## Implementation suggestion

Five concrete ports, in priority order:

1. **Excipient map.** Copy `panna-farm-hub-v2/supabase/functions/_shared/excipient-map.json` → `optibio-erp/data/excipient-map.json`. Add a small loader to `src/domains/formulation/knowledge-base.ts` and a seed script. Update `excipient-calculator.ts` to consult the map instead of hard-coded constants. ~2 hours.
2. **Ingredient synonyms.** Copy `ingredient-synonyms.json` → `optibio-erp/data/ingredient-synonyms.json`. Add `synonyms text[]` column to `ingredients` schema (or a separate `ingredient_synonyms` table). Update `findBestMatch` in `/api/extract/route.ts` to also match against synonyms. ~1 hour.
3. **Schema enrichment for ingredients.** Add `regulatoryStatus`, `allergenInfo`, `storageRequirements`, `shelfLifeMonths`, `costRangeMin`, `costRangeMax`, `lastPriceUpdate` fields to the `ingredients` table. Backfill from `Quote/airtable_ingredients_import.csv` where RM IDs match. ~1 hour.
4. **Lead sources.** Add a `lead_sources` table from `void-create-spark/supabase/migrations/20251107000000_crm_module.sql`. Add `lead_source_id` FK to `customers` (or a new `leads` table). Lets you track trade-show / referral / website ROI. ~1 hour.
5. **Supplier metadata.** Add `paymentTerms`, `leadTimeDays`, `moq`, `contactTitle` fields to `suppliers` from `Quote/airtable_suppliers_import.csv`. Backfill from CSV. ~30 min.

Total: **~5.5 hours of focused work** for measurable improvements to Eva's match rate, Danny's excipient suggestions, audit-ready ingredient metadata, ROI tracking on lead sources, and supplier-side procurement awareness.

---

## Cleanup

```bash
rm -rf /tmp/dead-repos
```

The 6 repos can stay archived on GitHub. Do not unarchive — this report is the durable extract. If you want to GitHub-archive the original 11 (per the parked task #31), do it any time; nothing else depends on them.
