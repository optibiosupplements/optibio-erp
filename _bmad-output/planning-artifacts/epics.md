# Epics & Stories

## Optibio ERP — Implementation Breakdown

**Date:** March 25, 2026
**Method:** BMAD Phase 3
**Total Stories:** 28
**Estimated Sprints:** 6 (1-week sprints)

---

## Epic 1: Foundation & Data Layer
**Priority:** Critical — everything depends on this
**Sprint:** 1

### Story 1.1: Database Schema & Drizzle Setup
**As a** developer, **I want** the complete database schema deployed **so that** all other features have a data layer to build on.

**Acceptance Criteria:**
- [ ] Drizzle ORM configured with Vercel Postgres
- [ ] All 16 tables created via migrations
- [ ] Schema types exported for TypeScript consumption
- [ ] `db:push` and `db:migrate` scripts working
- [ ] Connection pooling configured

**Files:** `src/lib/db/index.ts`, `src/lib/db/schema.ts`, `drizzle.config.ts`

### Story 1.2: Seed Ingredient Database
**As a** user, **I want** the 2,567 master ingredients loaded **so that** I can build formulations immediately.

**Acceptance Criteria:**
- [ ] Parse `OptiBio_Master_Ingredients_CLEANED.xlsx` into seed script
- [ ] All 23 columns mapped to schema fields
- [ ] Active Content % correctly populated (NOT Assay %)
- [ ] "Internal Database" supplier entries flagged with `is_estimated_price = true`
- [ ] Multi-component ingredients seeded (118 entries, 27 parents)
- [ ] Capsule sizes seeded (000 through 3)
- [ ] Seed endpoint `/api/seed` for one-time execution
- [ ] Verify count: exactly 2,567 ingredients after seed

**Files:** `src/lib/db/seed.ts`, `data/OptiBio_Master_Ingredients_CLEANED.xlsx`

### Story 1.3: App Shell & Navigation
**As a** user, **I want** a professional dashboard layout **so that** I can navigate between all system modules.

**Acceptance Criteria:**
- [ ] Sidebar navigation with sections: Dashboard, Quotes, Formulations, Ingredients, Customers, Pipeline, Packaging, Settings
- [ ] Brand colors applied (#d10a11 primary, #333333 secondary)
- [ ] Responsive layout (desktop-first, mobile-friendly)
- [ ] Active route highlighting
- [ ] Company logo placeholder in sidebar
- [ ] Shadcn UI components installed and configured

**Files:** `src/components/layout/*`, `src/app/(dashboard)/layout.tsx`

### Story 1.4: Authentication (Admin Login)
**As an** admin, **I want** to log in with email/password **so that** the system is secured.

**Acceptance Criteria:**
- [ ] Login page at `/login`
- [ ] Password hashing with bcrypt
- [ ] Session management (JWT or cookie-based)
- [ ] Protected routes redirect to login
- [ ] Single admin user seeded

**Files:** `src/lib/auth.ts`, `src/app/(auth)/login/page.tsx`

---

## Epic 2: Ingredient Master
**Priority:** High — required for formulation engine
**Sprint:** 2

### Story 2.1: Ingredient Database Page
**As a** user, **I want** to search, filter, and browse all 2,567 ingredients **so that** I can find ingredients for formulations.

**Acceptance Criteria:**
- [ ] Server-side paginated table (50 per page)
- [ ] Search by name, RM ID, scientific name (fuzzy matching)
- [ ] Filter by category, subcategory, supplier
- [ ] Sort by name, cost, category
- [ ] Display: name, RM ID, category, supplier, cost/kg, Active Content %, estimated price flag
- [ ] Click row to view full ingredient detail

**Files:** `src/app/(dashboard)/ingredients/page.tsx`, `src/domains/ingredients/ingredient.repository.ts`

### Story 2.2: Ingredient Detail & Edit
**As a** user, **I want** to view and edit ingredient details **so that** I can update pricing and specifications.

**Acceptance Criteria:**
- [ ] Detail view showing all 23 fields
- [ ] Inline editing of cost, Active Content %, overage/wastage
- [ ] Show all suppliers for this ingredient (multi-supplier view)
- [ ] Show multi-component breakdown (if applicable)
- [ ] Audit trail — updated_at timestamp on save

---

## Epic 3: Formulation Engine
**Priority:** Critical — core business logic
**Sprint:** 2–3

### Story 3.1: Pricing Engine (TDD)
**As a** system, **I want** accurate COGS calculations **so that** every quote is financially correct.

**Acceptance Criteria:**
- [ ] `pricing.engine.ts` with `computeCOGS()` function
- [ ] Formula: `Label Claim ÷ (Active Content % / 100) × (1 + Overage %) → RM cost`
- [ ] Wastage applied: `RM cost × (1 + Wastage %)`
- [ ] Manufacturing costs from cost centers
- [ ] Packaging costs from linked packaging DB
- [ ] Overhead: 15% of (RM + Manufacturing)
- [ ] Tiered pricing: 2K=40%, 5K=35%, 10K=30% margin
- [ ] **TEST:** Validate against TM503438 Living Collagen quote (known values)
- [ ] **TEST:** Validate against TM503438 Bone & Marrow quote
- [ ] **TEST:** B12 1% Trituration edge case — must calculate 500mg powder for 5mg dose
- [ ] All tests pass before merge

**Files:** `src/domains/pricing/pricing.engine.ts`, `src/__tests__/domains/pricing.engine.test.ts`

### Story 3.2: Capsule Sizer
**As a** user, **I want** automatic capsule size recommendations **so that** I know if a formulation is physically feasible.

**Acceptance Criteria:**
- [ ] Calculate total fill weight (actives + excipients)
- [ ] Compare against capsule capacity table
- [ ] Support 1–6 capsules per serving
- [ ] Return: feasible (bool), recommended size, fill percentage, warnings
- [ ] Suggest capsule size upgrade when overfilled
- [ ] **TEST:** Known formulations from Capsule Size Helper sheet

**Files:** `src/domains/formulation/capsule-sizer.ts`, `src/__tests__/domains/capsule-sizer.test.ts`

### Story 3.3: Excipient Calculator
**As a** system, **I want** automatic excipient calculation **so that** every capsule formula has proper flow agents and fillers.

**Acceptance Criteria:**
- [ ] Complexity detection: standard (<4 actives), moderate (4–8), high (>8 or botanicals)
- [ ] Silicon Dioxide: 0.5%/0.75%/1.0% by complexity
- [ ] Magnesium Stearate: 0.75%/0.75%/1.0% by complexity
- [ ] MCC filler: remainder to reach target fill weight
- [ ] Return feasibility + excipient breakdown
- [ ] **TEST:** Verify against known formulation excipient loads

**Files:** `src/domains/formulation/excipient-calculator.ts`, `src/__tests__/domains/excipient-calculator.test.ts`

### Story 3.4: Ingredient Selection Algorithm
**As a** system, **I want** intelligent ingredient variant selection **so that** the optimal ingredient is auto-picked per dosage form.

**Acceptance Criteria:**
- [ ] Step 1: Match by name/synonym with fuzzy search
- [ ] Step 2: Optimize assay by dosage form (higher for multi-ingredient capsule, lower for tablet)
- [ ] Step 3: Among matching assay, pick lowest cost supplier
- [ ] Step 4: User override dropdown showing all variants
- [ ] Return selected ingredient + alternatives + cost comparison

**Files:** `src/domains/formulation/ingredient-selector.ts`

### Story 3.5: Formulation Builder UI
**As a** user, **I want** a visual formulation builder **so that** I can create supplement formulas interactively.

**Acceptance Criteria:**
- [ ] Select dosage form (Capsule/Tablet)
- [ ] Add ingredients with search autocomplete
- [ ] Enter label claim mg per ingredient
- [ ] Auto-populate: Active Content %, overage, wastage from DB
- [ ] Real-time capsule fill tracker (visual progress bar)
- [ ] Auto-add excipients based on complexity
- [ ] Live cost preview per ingredient and total
- [ ] Save formulation to database
- [ ] Show warnings for feasibility issues

**Files:** `src/app/(dashboard)/formulations/[id]/page.tsx`, `src/components/forms/FormulationTable.tsx`

---

## Epic 4: Quote Generation
**Priority:** Critical — the deliverable
**Sprint:** 3–4

### Story 4.1: Quote Wizard
**As a** user, **I want** a step-by-step quote creation flow **so that** I can generate quotes efficiently.

**Acceptance Criteria:**
- [ ] Step 1: Select/create customer
- [ ] Step 2: Select/create formulation (or link existing)
- [ ] Step 3: Configure packaging (auto-linked from packaging DB)
- [ ] Step 4: Review all 3 pricing tiers side-by-side
- [ ] Step 5: Add notes, set validity period
- [ ] Save quote with auto-generated quote number (QT-YYYYMMDD-NNN)

**Files:** `src/app/(dashboard)/quotes/new/page.tsx`

### Story 4.2: Tiered Pricing Display
**As a** user, **I want** to see 2K/5K/10K pricing side-by-side **so that** I can present volume options to customers.

**Acceptance Criteria:**
- [ ] 3-column comparison table
- [ ] Per-tier: COGS breakdown (RM, manufacturing, packaging, overhead), margin %, price per unit, batch total
- [ ] Highlight best value tier
- [ ] Internal Database ingredients marked as "Estimated"

**Files:** `src/components/data-display/PricingTierTable.tsx`

### Story 4.3: PDF Quote Generator
**As a** user, **I want** professional PDF quotes **so that** I can send them to customers.

**Acceptance Criteria:**
- [ ] Company header: Optibio Supplements, 131 Heartland Blvd, Edgewood, NY 11717, (631) 939-2626
- [ ] Customer details
- [ ] Product specification summary
- [ ] Tiered pricing table (all 3 tiers)
- [ ] Optional: detailed ingredient breakdown (toggle)
- [ ] Terms & conditions section
- [ ] Validity period (default 30 days)
- [ ] Quote number and date
- [ ] Download as PDF from quote detail page
- [ ] API route: `GET /api/quotes/[id]/pdf`

**Files:** `src/domains/quotes/pdf-generator.ts`, `src/app/api/quotes/[id]/pdf/route.ts`

### Story 4.4: Quote Management
**As a** user, **I want** to track quote status **so that** I know where each quote stands.

**Acceptance Criteria:**
- [ ] Quote list page with status filters
- [ ] Status transitions: Draft → Sent → Viewed → Accepted → Rejected → Expired
- [ ] Version history (duplicate quote creates new version)
- [ ] Quote detail page with full breakdown

---

## Epic 5: CRM & Pipeline
**Priority:** High
**Sprint:** 4–5

### Story 5.1: Customer Management
**As a** user, **I want** to manage customers **so that** I have a single source of customer data.

**Acceptance Criteria:**
- [ ] Customer list with search and filters
- [ ] Create/edit customer (company, contact, email, phone, tier, notes)
- [ ] Customer detail showing: all quotes, all opportunities, activity history
- [ ] Customer tiers: Premium, Standard, Basic

### Story 5.2: NEPQ Sales Pipeline
**As a** user, **I want** a visual sales pipeline **so that** I can track deals through the NEPQ stages.

**Acceptance Criteria:**
- [ ] Kanban board with 5 NEPQ columns
- [ ] Drag-and-drop leads between stages
- [ ] Lead cards showing: customer, product interest, value, days in stage
- [ ] Create new lead from pipeline view
- [ ] Click lead to view detail

**Files:** `src/app/(dashboard)/pipeline/page.tsx`, `src/components/data-display/PipelineBoard.tsx`

### Story 5.3: Opportunities & Activities
**As a** user, **I want** to track opportunities and log activities **so that** I have full deal visibility.

**Acceptance Criteria:**
- [ ] Opportunity linked to customer, lead, and quote
- [ ] Stage tracking: Lead → Qualified → Proposal → Negotiation → Closed Won/Lost
- [ ] Probability and expected close date
- [ ] Activity log: calls, emails, meetings, notes

---

## Epic 6: Packaging & Manufacturing
**Priority:** Medium — supports costing accuracy
**Sprint:** 5

### Story 6.1: Packaging Materials Database
**As a** user, **I want** a packaging materials database **so that** packaging costs are automatically included in quotes.

**Acceptance Criteria:**
- [ ] CRUD for packaging materials (bottles, caps, labels, desiccants, sleeves, cartons)
- [ ] Link packaging to formulations
- [ ] Cost auto-included in quote generation
- [ ] Seed with common packaging from TM503438 data

### Story 6.2: Manufacturing Cost Centers
**As a** user, **I want** configurable manufacturing costs **so that** labor and overhead are accurately reflected.

**Acceptance Criteria:**
- [ ] CRUD for cost centers (labor, equipment, overhead, setup, QA)
- [ ] Product-format-specific costs (capsule vs tablet)
- [ ] Seed with real rates: $15/hr labor, 70K caps/hr, 1300 bottles/hr, 2% waste

---

## Epic 7: Dashboard & Analytics
**Priority:** High
**Sprint:** 5–6

### Story 7.1: Main Dashboard
**As a** user, **I want** a dashboard overview **so that** I see business health at a glance.

**Acceptance Criteria:**
- [ ] Metric cards: New Leads, Active Quotes, Pipeline Value, Quotes This Month
- [ ] Recent quotes table (last 10)
- [ ] Pipeline summary (count per NEPQ stage)
- [ ] Quick actions: New Quote, New Customer, Search Ingredients

### Story 7.2: Quote Analytics
**As a** user, **I want** quote analytics **so that** I understand pricing trends and conversion rates.

**Acceptance Criteria:**
- [ ] Quote count by status
- [ ] Average quote value
- [ ] Conversion rate (sent → accepted)
- [ ] Top ingredients by usage

---

## Sprint Plan

| Sprint | Stories | Focus |
|---|---|---|
| **Sprint 1** | 1.1, 1.2, 1.3, 1.4 | Foundation: DB, seed data, app shell, auth |
| **Sprint 2** | 2.1, 2.2, 3.1, 3.2, 3.3 | Ingredients + pricing engine (TDD) + capsule sizer |
| **Sprint 3** | 3.4, 3.5, 4.1 | Formulation builder + quote wizard |
| **Sprint 4** | 4.2, 4.3, 4.4, 5.1 | Tiered pricing, PDF quotes, customer management |
| **Sprint 5** | 5.2, 5.3, 6.1, 6.2 | CRM pipeline, packaging, manufacturing costs |
| **Sprint 6** | 7.1, 7.2, polish, deploy | Dashboard, analytics, final polish, production deploy |
