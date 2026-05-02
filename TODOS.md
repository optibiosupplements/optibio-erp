# TODOS

Living list. Update with each `/ship`. Close items when verified, not when "code is written."

## P0 — Phase 1 ship gates

- [ ] Boot test passes — `pnpm dev` → `localhost:3000` renders sidebar with all 10 modules.
- [ ] DB connected to Neon, `pnpm db:push` succeeds, all tables in `schema.ts` exist.
- [ ] Seed script imports ≥2,500 ingredients from real master sheets (NUTRA ERP + `data/OptiBio_Master_Ingredients_CLEANED.xlsx`).
- [ ] `/ingredients` page lists all seeded ingredients with search + filter + cost.
- [ ] Magic Box at `/intake/new` creates `RFQ-YYMM-####` row immediately on click. Format: `RFQ-2605-0001` (year-month, not year-month-day).
- [ ] Greedy parser ports from `supplement-quote-app26/client/src/lib/ingredientParser.ts` and lands at `src/domains/intake/ingredient-parser.ts`. All 14 unit tests pass.
- [ ] Format auto-detection works for "capsule"/"tablet"/"powder" keywords. Powder routes to "Phase 2 — quote manually" message.
- [ ] Submit-to-R&D button gated on `dosageForm` set + ≥1 active ingredient. Customer fields not required.
- [ ] Eva chat (`/api/agent`) responds with a sensible RFQ project name suggestion when given a parsed formula.
- [ ] Danny system prompt drafted at `src/domains/agents/danny.formulator.ts` — capsule shell rules, Phase 1 sizing, Phase 2 final excipients.
- [ ] Pricing engine produces a quote for the canonical case (Asher Elderberry 10:1 500mg + Vit C 90mg + Vit D 1000 IU + Zinc 11mg @ 2K bottles) within ±10% of the real $7.90/bottle.
- [ ] Quote PDF generates and matches `Desktop/Quotation/new quote app/PH Quote Template_Final1.xlsx` layout (volume tiers, packaging specs, line items).
- [ ] Asher Beetroot, Berberine HCl, Magnesium Glycinate cases also within ±10% of real pricing.
- [ ] Joe Hydration stickpack RFQ correctly routes to "format not supported" message.
- [ ] `/review` clean — no must-fix bugs.
- [ ] `/cso` clean — no critical OWASP/STRIDE findings.

## P1 — Workflow plumbing

- [ ] Port CRM (Lead → Opportunity → Quote stages) from `supplement-quote-app26/server/crm.ts` to Next.js Route Handlers.
- [ ] RFQ submit creates Opportunity at stage `RFQ_SUBMITTED` (per `crm.onRfqSubmitted`).
- [ ] Quote status `Sent` updates Opportunity to `QUOTE_SENT`.
- [ ] Quote versioning — each "Save changes" on an existing quote creates a new version.
- [ ] Pipeline page (`/pipeline`) renders the Lead/Opportunity/Quote kanban.
- [ ] Settings page lets the operator edit tier margins (default 2K/40%, 5K/35%, 10K/30%) and overhead %.

## P1 — gstack adoption

- [ ] gstack installed at `~/.claude/skills/gstack` and team-mode bootstrap run inside this repo.
- [ ] CLAUDE.md / AGENTS.md / ARCHITECTURE.md / DESIGN.md / ETHOS.md / TODOS.md / BROWSER.md committed (this file).
- [ ] First `/office-hours` run captured at `docs/office-hours.md`.
- [ ] First `/design-consultation` run captured at `docs/design-consultation.md`.
- [ ] All future PRs run `/review` before push and `/qa` against `localhost:3000` before merge.

## P2 — Hardening / Phase 2 prep

- [ ] Vitest set up. Port these tests from `supplement-quote-app26/server/`:
  - [ ] `capsuleQuoteEngine.test.ts`
  - [ ] `excipientCalculator.test.ts`
  - [ ] `ingredientParser.test.ts` (14 cases)
  - [ ] `crmActivity.test.ts`, `crmPivot.test.ts`, `domainPivot.test.ts`
  - [ ] `singlePageWorkbench.test.ts`
- [ ] Vercel preview deploy on every PR.
- [ ] Auth: NextAuth or Clerk wired up; admin role for Phase 1 (single user).
- [ ] AI-powered email RFQ parsing — Eva reads inbound email and creates draft RFQs.
- [ ] Add powder/stickpack support (Phase 2 expansion).
- [ ] Inventory/lot tracking.

## Setup checklist (do these in order)

1. **Neon DB.** Sign in at <https://console.neon.tech>, create a project, copy the **pooled** connection string. Paste into `.env.local` as `DATABASE_URL=...`.
2. **Anthropic API key.** Get one at <https://console.anthropic.com/settings/keys>. Paste into `.env.local` as `ANTHROPIC_API_KEY=sk-ant-...`.
3. **Push schema:** `pnpm db:push` — creates all tables in Neon.
4. **Seed master data:** `pnpm seed` — imports ~2,567 ingredients, 6 capsule sizes, 7 manufacturing cost centers. Idempotent.
5. **Run the app:** `pnpm dev` — open <http://localhost:3000>.
6. **Smoke test the Magic Box:** Run gstack `/qa` from the repo root. It will read `BROWSER.md` and walk the golden path.

## Done (rolling)

(Add items here as they're verified and merged. Keep last 30 days; archive older into `docs/changelog/`.)

- 2026-05-01 — Plan written, optibio-erp + supplement-quote-app26 cloned, gstack installed at `~/.claude/skills/gstack` (47 skills available), gstack-style docs landed (CLAUDE/AGENTS/ARCHITECTURE/DESIGN/ETHOS/TODOS/BROWSER), parser + format-detector + id-generator + Eva/Danny system prompts ported to optibio-erp, NUTRA ERP master sheets copied to `data/`, `.env.local` template created, `scripts/seed.ts` written (idempotent, supports both column schemas, includes capsule sizes and PRD-spec cost centers), `pnpm db:push` and `pnpm seed` scripts wired in `package.json`, real-customer regression fixtures captured.
