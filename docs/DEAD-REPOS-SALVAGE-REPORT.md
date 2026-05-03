# Dead Repos — Salvage Report

Produced 2026-05-03 by mining the 6 viable archived OptiBio repos. The other 6 in the original 12 (advanced-supplements-api, advanced-supplements-dashboard, adv-supp-flask-api, adv-supp-frontend, void-create-spark, qutoe2) were either empty, scaffold-only, or in a different stack and skipped.

Repos cloned shallow to `/tmp/dead-repos/`. Delete with `rm -rf /tmp/dead-repos` after porting what you want.

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

## Implementation suggestion

Three concrete ports, in priority order:

1. **Excipient map.** Copy `panna-farm-hub-v2/supabase/functions/_shared/excipient-map.json` → `optibio-erp/data/excipient-map.json`. Add a small loader to `src/domains/formulation/knowledge-base.ts` and a seed script. Update `excipient-calculator.ts` to consult the map instead of hard-coded constants. ~2 hours.
2. **Ingredient synonyms.** Copy `ingredient-synonyms.json` → `optibio-erp/data/ingredient-synonyms.json`. Add `synonyms text[]` column to `ingredients` schema (or a separate `ingredient_synonyms` table). Update `findBestMatch` in `/api/extract/route.ts` to also match against synonyms. ~1 hour.
3. **Schema enrichment for ingredients.** Add `regulatoryStatus`, `allergenInfo`, `storageRequirements`, `shelfLifeMonths`, `costRangeMin`, `costRangeMax`, `lastPriceUpdate` fields to the `ingredients` table. Backfill from `Quote/airtable_ingredients_import.csv` where RM IDs match. ~1 hour.

Total: **~4 hours of focused work** for tangible improvements to Eva's match rate, Danny's excipient suggestions, and audit-ready ingredient metadata.

---

## Cleanup

```bash
rm -rf /tmp/dead-repos
```

The 6 repos can stay archived on GitHub. Do not unarchive — this report is the durable extract. If you want to GitHub-archive the original 11 (per the parked task #31), do it any time; nothing else depends on them.
