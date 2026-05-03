@AGENTS.md
@ETHOS.md
@ARCHITECTURE.md
@DESIGN.md
@BROWSER.md
@TODOS.md

# Project: Optibio ERP

AI-Powered Nutraceutical Manufacturing Management System for OptiBio Supplements / NUTRA SOLUTIONS USA.

Replaces the current Excel-based RFQ → bench formulation → quote → CRM workflow. Phase 1 scope is **capsules + tablets only** (per `_bmad-output/planning-artifacts/PRD.md`). Powders, stick packs, gummies, softgels, ODT are explicitly out of Phase 1.

## How to work in this repo

1. **Plan before code.** For any non-trivial change, run `/autoplan` → `/plan-ceo-review` → `/plan-eng-review`. UI work also runs `/plan-design-review`.
2. **Use real data, never fixtures.** Master ingredient data lives in `data/` and is seeded from real NUTRA ERP master sheets. Real customer quotes (Asher Elderberry/Beet/Berberine/Magnesium, Joe Hydration) are the canonical regression cases — see `tests/fixtures/`.
3. **Active Content %, not Assay %.** All cost calculations use `activeContentPct` from `ingredients`. `assayPercentage` is for spec compliance only. See `src/domains/pricing/pricing.engine.ts`.
4. **The two AI agents.** Eva = intake/CRM (`src/components/deal/EvaChat.tsx` + `src/app/api/agent/route.ts`). Danny = bench formulator (capsule sizer + GMP rules; lives in `src/domains/formulation/`). Do not blur their roles.
5. **RFQ-on-click rule.** The `/intake/new` Magic Box must create the RFQ row immediately on "Analyze & Auto-Fill" — before parsing succeeds. Parsing failures must never block creation. See `src/app/api/intake/route.ts`.
6. **Customer/contact section is enrichment, not gating.** Submit-to-R&D requires only `dosageForm` + ≥1 active ingredient. Email/phone/company are optional throughout.

## Stack

- **Framework:** Next.js 16 (App Router) with **breaking changes** vs. older Next — read `node_modules/next/dist/docs/` before invoking deprecated APIs.
- **DB:** PostgreSQL via Neon (serverless). Drizzle ORM. Schema in `src/lib/db/schema.ts`.
- **AI:** `@anthropic-ai/sdk` for Eva + Danny.
- **PDF:** `pdfkit` for quote generation.
- **UI:** Tailwind v4 + shadcn-style Radix primitives. Lucide icons.
- **Package manager:** pnpm.
- **Build/test:** `pnpm dev` / `pnpm build` / `pnpm lint`. Test runner not yet set up — add Vitest when porting tests from `supplement-quote-app26`.

## gstack workflow (Garry Tan's setup)

This repo uses [`gstack`](https://github.com/garrytan/gstack) for plan/review/QA/ship discipline. **Solo-operator default loop is 6 commands** — that's it. Don't run the rest unless the work asks for it.

### Primary loop (use these by default)

| Phase | Command | Purpose |
|---|---|---|
| Plan | `/autoplan` | Multi-role plan review for any non-trivial feature |
| Pre-push | `/review` | Pre-PR review for prod-bug-class issues |
| QA | `/qa` | Real-Chromium smoke test before merge |
| Release | `/ship` | Test → push → PR → land |
| After ship | `/document-release` | Auto-update CHANGELOG / TODOS / ARCHITECTURE |
| Weekly | `/retro` | KPI delta review |

### Advanced (à la carte — only when the work needs them)

The full gstack ships ~47 commands. Reach for these only when a specific problem matches:

- **CEO/Eng/Design plan reviews:** `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/plan-devex-review` — for major architecture or scope decisions
- **Design system work:** `/design-consultation`, `/design-shotgun`, `/design-html`, `/design-review` — only when building a new screen from scratch
- **Browser:** `/browse`, `/connect-chrome`, `/setup-browser-cookies` — sub-tools used by `/qa`. **Use these, not `mcp__claude-in-chrome__*`.**
- **Safety rails:** `/careful`, `/freeze`, `/guard` — when editing destructive code paths
- **Security:** `/cso` — once before first prod deploy, then monthly
- **Release variants:** `/canary`, `/land-and-deploy` — when shipping risky changes
- **Debugging:** `/investigate`, `/debug`, `/learn` — when stuck on a specific bug
- **Kickoff:** `/office-hours` — for reframing a fuzzy product idea

The full list lives under `~/.claude/skills/gstack/`. Solo, the 6-command loop is enough. Bureaucracy is what killed the prior 13 repos — protect your shipping cadence.

BMAD method (planning-only) is also installed under `_bmad/` and `.claude/skills/bmad-*`. BMAD is for upfront PRD/architecture/epics; gstack is for the daily plan→build→review→ship loop.

## Directives that supersede defaults

- Never write code that supports gummies/liquids/softgels/ODT in Phase 1. If a customer RFQ has one of those formats, route to a "format not yet supported in Optibio ERP — quote manually" message.
- Never assume a customer/email/phone is required. The RFQ container is decoupled from the lead/customer record; CRM linkage happens later.
- Never use `mcp__claude-in-chrome__*` tools — use `/browse` from gstack for browser work.
- Always preserve user-selected `dosageForm` if they manually picked one before re-running auto-detect.
