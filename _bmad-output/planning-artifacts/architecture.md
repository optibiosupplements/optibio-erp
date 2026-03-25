# Architecture Document

## OptiBio ERP — System Architecture

**Version:** 1.0.0
**Date:** March 25, 2026
**Architect:** Consulting Team (BMAD Phase 3)
**Status:** Final

---

## 1. Architecture Overview

### Pattern: Modular Monolith with DDD Bounded Contexts

OptiBio ERP is a **Next.js full-stack application** using the App Router with server components, server actions, and API routes. The architecture follows a **Modular Monolith** pattern — a single deployable unit with clear internal boundaries between business domains. This is the correct choice for a team of 1–3 developers building an MVP, with a clean migration path to microservices if needed later.

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Edge + Serverless)            │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Next.js App Router                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │  Pages   │ │  Server  │ │   API Routes     │  │  │
│  │  │  (RSC)   │ │  Actions │ │   /api/*         │  │  │
│  │  └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │  │
│  │       │             │                │            │  │
│  │  ┌────▼─────────────▼────────────────▼─────────┐  │  │
│  │  │           Domain Layer (DDD Modules)         │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌───────────────┐  │  │  │
│  │  │  │Ingredient│ │Formula- │ │   Pricing     │  │  │  │
│  │  │  │ Master  │ │  tion   │ │   Engine      │  │  │  │
│  │  │  └─────────┘ └─────────┘ └───────────────┘  │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌───────────────┐  │  │  │
│  │  │  │  Quote  │ │   CRM   │ │  Packaging    │  │  │  │
│  │  │  │ Manager │ │         │ │               │  │  │  │
│  │  │  └─────────┘ └─────────┘ └───────────────┘  │  │  │
│  │  └─────────────────┬───────────────────────────┘  │  │
│  │                    │                              │  │
│  │  ┌─────────────────▼───────────────────────────┐  │  │
│  │  │         Data Access Layer (Drizzle ORM)      │  │  │
│  │  └─────────────────┬───────────────────────────┘  │  │
│  └────────────────────┼──────────────────────────────┘  │
│                       │                                  │
│  ┌────────────────────▼───────────────────────────────┐ │
│  │            Vercel Postgres (Neon)                   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
optibio-erp/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth layout group
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/              # Dashboard layout group
│   │   │   ├── layout.tsx            # Sidebar + navigation
│   │   │   ├── page.tsx              # Main dashboard
│   │   │   ├── quotes/
│   │   │   │   ├── page.tsx          # Quote list
│   │   │   │   ├── new/page.tsx      # New quote wizard
│   │   │   │   └── [id]/page.tsx     # Quote detail
│   │   │   ├── formulations/
│   │   │   │   ├── page.tsx          # Formulation list
│   │   │   │   └── [id]/page.tsx     # Formulation builder
│   │   │   ├── ingredients/
│   │   │   │   └── page.tsx          # Ingredient database
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx          # Customer list
│   │   │   │   └── [id]/page.tsx     # Customer detail
│   │   │   ├── pipeline/
│   │   │   │   └── page.tsx          # NEPQ sales pipeline
│   │   │   ├── packaging/
│   │   │   │   └── page.tsx          # Packaging materials
│   │   │   └── settings/
│   │   │       └── page.tsx          # System settings
│   │   ├── api/                      # API routes
│   │   │   ├── quotes/
│   │   │   │   ├── route.ts          # CRUD
│   │   │   │   ├── [id]/pdf/route.ts # PDF generation
│   │   │   │   └── [id]/route.ts
│   │   │   ├── formulations/
│   │   │   │   └── route.ts
│   │   │   ├── ingredients/
│   │   │   │   ├── route.ts
│   │   │   │   └── search/route.ts
│   │   │   └── seed/route.ts         # Data seeding endpoint
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css
│   │
│   ├── domains/                      # DDD Domain Modules
│   │   ├── ingredients/
│   │   │   ├── ingredient.repository.ts
│   │   │   ├── ingredient.service.ts
│   │   │   ├── ingredient.types.ts
│   │   │   └── overage-rules.ts      # Industry overage/wastage rules
│   │   ├── formulation/
│   │   │   ├── formulation.service.ts
│   │   │   ├── formulation.types.ts
│   │   │   ├── capsule-sizer.ts      # Capsule feasibility checks
│   │   │   ├── excipient-calculator.ts
│   │   │   └── ingredient-selector.ts # 4-step selection algorithm
│   │   ├── pricing/
│   │   │   ├── pricing.engine.ts     # COGS + tiered pricing
│   │   │   ├── pricing.types.ts
│   │   │   └── margin-rules.ts
│   │   ├── quotes/
│   │   │   ├── quote.repository.ts
│   │   │   ├── quote.service.ts
│   │   │   ├── quote.types.ts
│   │   │   └── pdf-generator.ts      # PDFKit quote generation
│   │   ├── crm/
│   │   │   ├── customer.repository.ts
│   │   │   ├── lead.repository.ts
│   │   │   ├── opportunity.repository.ts
│   │   │   └── crm.types.ts
│   │   ├── packaging/
│   │   │   ├── packaging.repository.ts
│   │   │   ├── packaging.service.ts
│   │   │   └── packaging.types.ts
│   │   └── manufacturing/
│   │       ├── cost-center.repository.ts
│   │       └── manufacturing.types.ts
│   │
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # Shadcn UI primitives
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── DashboardShell.tsx
│   │   ├── forms/
│   │   │   ├── IngredientSearch.tsx
│   │   │   └── FormulationTable.tsx
│   │   └── data-display/
│   │       ├── StatsCard.tsx
│   │       ├── PipelineBoard.tsx
│   │       └── PricingTierTable.tsx
│   │
│   ├── lib/                          # Infrastructure
│   │   ├── db/
│   │   │   ├── index.ts              # Drizzle client
│   │   │   ├── schema.ts             # Complete schema
│   │   │   └── seed.ts               # Data seeding
│   │   ├── auth.ts                   # Authentication
│   │   └── utils.ts                  # Shared utilities
│   │
│   └── __tests__/                    # Tests
│       ├── domains/
│       │   ├── pricing.engine.test.ts
│       │   ├── capsule-sizer.test.ts
│       │   ├── excipient-calculator.test.ts
│       │   └── ingredient-selector.test.ts
│       └── integration/
│           └── quote-flow.test.ts
│
├── drizzle/                          # Migrations
├── data/                             # Seed data files
│   └── OptiBio_Master_Ingredients_CLEANED.xlsx
├── _bmad/                            # BMAD configuration
├── _bmad-output/                     # BMAD artifacts
└── docs/                             # Project documentation
```

---

## 3. Database Schema

### 3.1 Core Tables

#### `customers`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_name    TEXT NOT NULL
contact_name    TEXT
email           TEXT
phone           TEXT
address         TEXT
tier            TEXT DEFAULT 'Standard'  -- Premium, Standard, Basic
notes           TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `suppliers`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_name    TEXT NOT NULL
contact_name    TEXT
email           TEXT
phone           TEXT
payment_terms   TEXT
notes           TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `ingredients`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
rm_id                 TEXT UNIQUE NOT NULL          -- RM00001
name                  TEXT NOT NULL
scientific_name       TEXT
category              TEXT NOT NULL                  -- Botanicals, Vitamins, Minerals, etc.
subcategory           TEXT
supplier_id           UUID REFERENCES suppliers(id)
supplier_name         TEXT                           -- Denormalized for quick access
cost_per_kg           NUMERIC(10,2) NOT NULL
assay_percentage      NUMERIC(5,2) DEFAULT 100
active_content_pct    NUMERIC(5,2) NOT NULL          -- ⭐ THE calculation field
active_source         TEXT                           -- assay_as_spec, name_elemental, etc.
label_claim_active    BOOLEAN DEFAULT true
multi_component       BOOLEAN DEFAULT false
base_overage_pct      NUMERIC(5,2) DEFAULT 10
base_wastage_pct      NUMERIC(5,2) DEFAULT 3
overage_capsule       NUMERIC(5,2)
overage_tablet        NUMERIC(5,2)
overage_powder        NUMERIC(5,2)
overage_stick_pack    NUMERIC(5,2)
wastage_capsule       NUMERIC(5,2)
wastage_tablet        NUMERIC(5,2)
wastage_powder        NUMERIC(5,2)
wastage_stick_pack    NUMERIC(5,2)
function_desc         TEXT
is_estimated_price    BOOLEAN DEFAULT false          -- True for "Internal Database" entries
moq_kg                NUMERIC(10,2)
lead_time_days        INTEGER
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

#### `ingredient_components`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
parent_ingredient_id  UUID REFERENCES ingredients(id) ON DELETE CASCADE
component_name        TEXT NOT NULL                  -- e.g., "Magnesium"
component_type        TEXT NOT NULL                  -- Mineral, Compound
mg_per_gram           NUMERIC(10,4) NOT NULL         -- e.g., 160 for MgCitrate
elemental_pct         NUMERIC(5,4) NOT NULL          -- e.g., 0.16
daily_value_mg        NUMERIC(10,2)
notes                 TEXT
```

### 3.2 Formulation Tables

#### `formulations`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                  TEXT NOT NULL
customer_id           UUID REFERENCES customers(id)
dosage_form           TEXT NOT NULL                  -- Capsule, Tablet
capsule_size          TEXT                           -- 00, 0, 1, 2, 3
capsules_per_serving  INTEGER DEFAULT 1
servings_per_container INTEGER
batch_size            INTEGER
total_fill_mg         NUMERIC(10,2)
fill_percentage       NUMERIC(5,2)
excipient_complexity  TEXT DEFAULT 'standard'        -- standard, moderate, high
version               INTEGER DEFAULT 1
status                TEXT DEFAULT 'Draft'           -- Draft, Review, Approved, Archived
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

#### `formulation_ingredients`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
formulation_id        UUID REFERENCES formulations(id) ON DELETE CASCADE
ingredient_id         UUID REFERENCES ingredients(id)
label_claim_mg        NUMERIC(10,4) NOT NULL         -- What appears on label
active_content_pct    NUMERIC(5,2) NOT NULL           -- Copied at time of formulation
adjusted_mg           NUMERIC(10,4) NOT NULL           -- After Active Content adjustment
overage_pct           NUMERIC(5,2) NOT NULL
final_mg              NUMERIC(10,4) NOT NULL           -- After overage
cost_per_kg           NUMERIC(10,2) NOT NULL           -- Locked at time of formulation
wastage_pct           NUMERIC(5,2) NOT NULL
line_cost             NUMERIC(10,4) NOT NULL           -- Cost for this ingredient per unit
is_excipient          BOOLEAN DEFAULT false
sort_order            INTEGER DEFAULT 0
```

### 3.3 Quote & Pricing Tables

#### `quotes`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
quote_number          TEXT UNIQUE NOT NULL             -- QT-20260325-001
customer_id           UUID REFERENCES customers(id)
formulation_id        UUID REFERENCES formulations(id)
status                TEXT DEFAULT 'Draft'             -- Draft, Sent, Viewed, Accepted, Rejected, Expired
version               INTEGER DEFAULT 1
valid_until           DATE
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

#### `quote_tiers`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
quote_id              UUID REFERENCES quotes(id) ON DELETE CASCADE
tier_quantity          INTEGER NOT NULL                -- 2000, 5000, 10000
raw_material_cost     NUMERIC(10,4) NOT NULL
manufacturing_cost    NUMERIC(10,4) NOT NULL
packaging_cost        NUMERIC(10,4) NOT NULL
overhead_cost         NUMERIC(10,4) NOT NULL
cogs_per_unit         NUMERIC(10,4) NOT NULL
margin_pct            NUMERIC(5,2) NOT NULL            -- 40, 35, 30
price_per_unit        NUMERIC(10,4) NOT NULL
total_batch_price     NUMERIC(12,2) NOT NULL
```

#### `quote_line_items`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
quote_tier_id         UUID REFERENCES quote_tiers(id) ON DELETE CASCADE
line_type             TEXT NOT NULL                    -- raw_material, packaging, manufacturing, labor, setup, qa, overhead
description           TEXT NOT NULL
quantity              NUMERIC(10,3)
unit_cost             NUMERIC(10,4)
total_cost            NUMERIC(10,2) NOT NULL
sort_order            INTEGER DEFAULT 0
```

### 3.4 Packaging Tables

#### `packaging_materials`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
material_id           TEXT UNIQUE NOT NULL             -- PKG-BTL-001
name                  TEXT NOT NULL
type                  TEXT NOT NULL                    -- bottle, cap, label, desiccant, sleeve, carton, pallet
size                  TEXT
supplier_id           UUID REFERENCES suppliers(id)
base_cost             NUMERIC(10,4) NOT NULL
moq                   INTEGER
lead_time_days        INTEGER
is_active             BOOLEAN DEFAULT true
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

#### `formulation_packaging`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
formulation_id        UUID REFERENCES formulations(id) ON DELETE CASCADE
material_id           UUID REFERENCES packaging_materials(id)
quantity_per_unit      NUMERIC(10,4) DEFAULT 1
notes                 TEXT
```

### 3.5 Manufacturing Tables

#### `manufacturing_cost_centers`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                  TEXT NOT NULL
cost_type             TEXT NOT NULL                    -- labor, equipment, overhead, setup, qa
product_format        TEXT                             -- capsule, tablet, all
cost_per_unit         NUMERIC(10,4)
cost_per_hour         NUMERIC(10,2)
cost_per_batch        NUMERIC(10,2)
is_active             BOOLEAN DEFAULT true
notes                 TEXT
```

### 3.6 CRM Tables

#### `leads`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id           UUID REFERENCES customers(id)
title                 TEXT NOT NULL
source                TEXT                             -- Website, Email, Phone, Referral
nepq_stage            TEXT DEFAULT 'initial_contact'   -- initial_contact, problem_awareness, pain_amplification, solution_presentation, commitment
assigned_to           TEXT
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

#### `opportunities`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id           UUID REFERENCES customers(id)
lead_id               UUID REFERENCES leads(id)
quote_id              UUID REFERENCES quotes(id)
title                 TEXT NOT NULL
value                 NUMERIC(12,2)
stage                 TEXT DEFAULT 'Lead'              -- Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
probability           INTEGER DEFAULT 0
expected_close_date   DATE
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

#### `activities`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id           UUID REFERENCES customers(id)
lead_id               UUID REFERENCES leads(id)
opportunity_id        UUID REFERENCES opportunities(id)
type                  TEXT NOT NULL                    -- call, email, meeting, note, task
subject               TEXT NOT NULL
description           TEXT
completed_at          TIMESTAMPTZ
created_at            TIMESTAMPTZ DEFAULT now()
```

### 3.7 System Tables

#### `users`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                  TEXT NOT NULL
email                 TEXT UNIQUE NOT NULL
role                  TEXT DEFAULT 'user'              -- admin, user
created_at            TIMESTAMPTZ DEFAULT now()
```

#### `capsule_sizes`
```sql
size                  TEXT PRIMARY KEY                 -- 000, 00, 0, 1, 2, 3
capacity_mg           NUMERIC(10,2) NOT NULL
cost_per_1000         NUMERIC(10,2) DEFAULT 6.00
```

**Total: 16 tables** (optimized from v2's 22 — removed redundant tables, merged where appropriate)

---

## 4. Architecture Decision Records (ADRs)

### ADR-1: Next.js over Express
**Decision:** Use Next.js App Router (full-stack) instead of Express + separate React frontend.
**Rationale:** Eliminates CORS, simplifies deployment (single Vercel project), enables Server Components for fast data loading, and aligns with modern React patterns. Previous codebases used Express+Vite or Express+React which created deployment complexity.

### ADR-2: PostgreSQL over MySQL
**Decision:** Use PostgreSQL (Vercel Postgres/Neon) instead of MySQL (TiDB/Railway).
**Rationale:** Better JSON support, UUID native types, superior full-text search, and native integration with Vercel. Previous MySQL-based repos required separate Railway databases.

### ADR-3: Active Content % as primary calculation field
**Decision:** Use `active_content_pct` for ALL dosage calculations, NOT `assay_percentage`.
**Rationale:** Assay often equals 100% (passes spec) while Active Content reflects actual potency (e.g., B12 1% Trituration: Assay=100%, Active Content=1%). Using Assay would produce catastrophically wrong dosages.

### ADR-4: Modular Monolith over Microservices
**Decision:** Single deployable with DDD internal boundaries.
**Rationale:** Team of 1–3 developers, MVP stage, no need for service mesh complexity. Clean module boundaries allow future extraction if needed.

### ADR-5: Drizzle ORM over Prisma
**Decision:** Use Drizzle ORM for database access.
**Rationale:** Better TypeScript inference, lighter weight, SQL-like query builder, native PostgreSQL feature support. Proven in the pannas-erp codebase.

### ADR-6: Server Actions for mutations, API routes for external/PDF
**Decision:** Use Next.js Server Actions for form submissions and data mutations. Use API routes only for PDF generation, webhook endpoints, and external integrations.
**Rationale:** Server Actions eliminate boilerplate, provide automatic revalidation, and work natively with React Server Components.

---

## 5. Security Architecture

### Phase 1 (MVP)
- **Authentication:** Simple admin login (email + password with bcrypt)
- **Authorization:** Single admin role (RBAC expansion in Phase 2)
- **Data:** All connections over HTTPS (Vercel default), Postgres SSL
- **Secrets:** Environment variables via Vercel dashboard (never in code)

---

## 6. Deployment Architecture

```
GitHub (optibiosupplements/optibio-erp)
    │
    ├── push to main ──→ Vercel Production Deploy
    │                         │
    │                         ├── Next.js App (Serverless Functions)
    │                         └── Vercel Postgres (Neon)
    │
    └── push to dev ───→ Vercel Preview Deploy
```

- **Production:** Auto-deploy on push to `main`
- **Preview:** Auto-deploy on PR branches
- **Database:** Vercel Postgres with connection pooling
- **Domain:** Custom domain (future)
