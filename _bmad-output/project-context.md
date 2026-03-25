# Project Context — Optibio ERP/CRM

## Project Overview
**Name:** Optibio ERP
**Domain:** Nutraceutical (dietary supplement) brokerage and contract manufacturing
**Business:** Optibio / Optibio Supplements — a supplement development and manufacturing partner providing end-to-end solutions for brands launching dietary supplement products
**Goal:** Unified ERP/CRM system that automates the RFQ-to-Quote workflow, reducing quote generation from 2-4 hours to under 30 minutes

## Technology Stack
- **Framework:** Next.js 16 (App Router, `src/` directory)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL via Vercel Postgres (powered by Neon)
- **ORM:** Drizzle ORM
- **Styling:** Tailwind CSS 4 + Shadcn UI components
- **Deployment:** Vercel (auto-deploy from GitHub)
- **AI:** Anthropic Claude API for RFQ parsing, formulation assistance
- **PDF:** PDFKit for professional quote generation
- **Testing:** Vitest for unit tests, TDD for pricing engine

## Development Methodology
- **BMAD Method** — Structured AI-driven agile delivery (Analysis → Planning → Solutioning → Implementation)
- **Domain-Driven Design (DDD)** — Bounded contexts, ubiquitous language, domain entities
- **Test-Driven Development (TDD)** — Mandatory for pricing engine and formulation calculations
- **Clean Architecture** — Domain logic independent of UI/DB/framework
- **Conventional Commits** — All commit messages follow conventional commit format

## Domain Language (Ubiquitous Language)
| Term | Definition |
|---|---|
| **Active Content %** | The actual potency/concentration of a nutrient in a raw material powder. Used for ALL dosage calculations. NOT the same as Assay %. |
| **Assay %** | Whether a raw material passes its specification test (often 100%). NOT used for dosage calculations. |
| **Label Claim** | The amount of active ingredient declared on the supplement facts panel (what the customer sees) |
| **Overage** | Extra ingredient added during manufacturing to ensure label claim is met through shelf life. Varies by ingredient category and dosage form. |
| **Wastage** | Material lost during manufacturing process. Varies by ingredient type and dosage form. |
| **MOQ** | Minimum Order Quantity — the smallest batch the manufacturer will produce |
| **RFQ** | Request for Quote — a customer's inquiry for pricing on a supplement product |
| **NPEF** | New Product Evaluation Form — internal form used for production costing (Part A: RM, Part B: Production, Part C: Packaging) |
| **COGS** | Cost of Goods Sold — total cost to produce one unit |
| **Excipient** | Non-active ingredients added for manufacturing purposes (fillers, flow agents, lubricants) |
| **Multi-component ingredient** | An ingredient that contains multiple active nutrients (e.g., Magnesium Citrate = 16% elemental Magnesium + 84% Citrate) |
| **Claim Basis** | How the label claim is expressed: `elemental` (e.g., "Magnesium 200mg"), `as_is` (e.g., "Turmeric Extract 500mg"), or `analyte` (specific marker compound) |
| **Co-Packer** | Contract manufacturer that produces the supplement |
| **NEPQ** | Sales methodology stages: Initial Contact → Problem Awareness → Pain Point Amplification → Solution Presentation → Commitment |

## Bounded Contexts (DDD)
1. **Ingredient Master** — Ingredient database, supplier pricing, active content, overage/wastage rules, multi-component tracking
2. **Formulation Engine** — Capsule/tablet sizing, excipient calculation, assay optimization, ingredient selection algorithm
3. **Pricing Engine** — Tiered pricing (2K/5K/10K), COGS calculation, margin management, batch costing
4. **Quote Management** — Quote generation, PDF output, version tracking, validity periods
5. **CRM** — Leads, opportunities, NEPQ pipeline, customer tiers, activity tracking
6. **RFQ Processing** — Email intake, AI parsing, product spec extraction, inquiry management
7. **Packaging** — Packaging materials DB, volume-based pricing, formula-packaging linkage
8. **Manufacturing** — Cost centers (labor, equipment, overhead, setup, QA), co-packer management

## Key Business Rules
- **Formula:** `Adjusted Amount = Label Dose ÷ (Active Content % / 100)`, then `× (1 + Overage %)`, then wastage applied to cost
- **Tiered Pricing:** 2K units = 40% margin, 5K = 35%, 10K = 30%
- **Overhead:** 15% of (RM + Manufacturing)
- **Internal Database prices** must be flagged as "Estimated — Verify Before Sending" in quotes
- **Capsule sizing:** Must check physical feasibility (fill weight vs capsule capacity)
- **Excipients:** Auto-calculated based on formulation complexity (standard/moderate/high)
- **Ingredient selection:** 4-step algorithm: Match → Assay Optimize by dosage form → Cost Optimize → Manual Override

## Data Sources
- **Master Ingredient Database:** 2,567 cleaned records, 23 columns, from `OptiBio_Master_Ingredients_CLEANED.xlsx`
- **Overage/Wastage Rules:** Industry-sourced (CRN/EAS, FDA 21 CFR), per-category, per-dosage-form, per-vitamin granularity
- **Multi-component DB:** 118 entries, 27 parent ingredients
- **Capsule sizes:** Size 1 (400mg), Size 0 (500mg), Size 00 (735mg)

## Existing Assets (Reference Only — NOT to be imported as code)
8 previous codebases exist as reference for proven business logic:
- `supplement-quote-app26` — Capsule quote engine, excipient calculator, assay rules, IU conversions
- `supplement-quote-system` — Tiered pricing engine, PDF generator, cost optimizer, knowledge base
- `panna-farm-hub-v2` — BMAD PRD, 22-table PostgreSQL schema, SQL templates
- `pannas-erp` — Next.js + Drizzle pattern, email webhook pipeline
- These are REFERENCE ONLY — the new system is built fresh following BMAD methodology

## Implementation Rules
- All prices in USD only
- No multi-currency support needed
- No shipping calculations
- Lead time is fixed text: "8-12 weeks after batch sheet approval"
- Version control required for formulas and quotes
- Phase 1 supports Capsules + Tablets only (no powders, stick packs, liquids, gummies)
- Fast-dissolving tablets excluded from Phase 1
- Brand colors: Primary red (#d10a11), secondary dark (#333333)
