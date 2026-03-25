# Product Requirements Document (PRD)

## OptiBio ERP — AI-Powered Nutraceutical Manufacturing Management System

**Product:** OptiBio ERP
**Version:** 1.0.0
**Date:** March 25, 2026
**Status:** Draft
**Framework:** BMAD Method
**Owner:** Panna (OptiBio / Advanced Supplements)

---

## 1. Executive Summary

OptiBio ERP is a unified enterprise resource planning and customer relationship management system purpose-built for the nutraceutical brokerage industry. It automates the complete RFQ-to-Quote workflow — from customer inquiry through formulation, costing, and professional quote delivery — reducing quote turnaround from 2–4 hours to under 30 minutes.

The system consolidates fragmented operations (8 previous attempts, 49+ source documents, multiple spreadsheets) into a single, production-grade platform with a master ingredient database of 2,567 ingredients, intelligent formulation engine, and AI-powered cost optimization.

---

## 2. Problem Statement

### Current State
- Quote generation takes **2–4 hours** of manual work per product
- Business data is scattered across **8 GitHub repos, 49+ Google Drive files, and multiple Excel spreadsheets** — none production-ready
- No single source of truth for ingredient pricing, formulation rules, or customer data
- Manual calculations are error-prone (multiple contradicting formulas found across sources)
- No CRM — customer relationships tracked informally
- No version control on quotes or formulations

### Business Impact
- Lost deals due to slow quote turnaround (industry standard: 24–48 hours; target: 5–30 minutes)
- Margin erosion from calculation errors
- Inability to scale — each new quote requires senior staff time
- No visibility into sales pipeline or customer lifecycle

### Target State
- **<30 minute** end-to-end quote generation
- **Single platform** for ingredients, formulations, quotes, customers, and pipeline
- **Accurate costing** using Active Content % (not Assay %), industry-standard overage/wastage, and real production cost structures
- **Professional PDF quotes** with tiered pricing (2K/5K/10K units)
- **CRM** with NEPQ sales pipeline tracking

---

## 3. Target Users

### Primary Users

| User | Role | Key Needs |
|---|---|---|
| **Panna (Owner)** | Business owner, formulator, sales | Fast quotes, margin visibility, customer management |
| **Sales Team** | Quote generation, customer communication | Simple intake, fast turnaround, professional output |
| **Operations** | Cost validation, production coordination | Detailed cost breakdowns, variance tracking |

### Secondary Users

| User | Role | Key Needs |
|---|---|---|
| **Customers** | Receive quotes | Clear pricing, professional presentation, tiered options |
| **Co-Packers** | Manufacturing partners | Production specs, batch sheets |

---

## 4. Scope

### In Scope (Phase 1)
- Master ingredient database (2,567 ingredients, 23 fields)
- Formulation engine (capsules + tablets)
- Tiered pricing engine (2K/5K/10K units)
- Professional PDF quote generation
- CRM with NEPQ sales pipeline
- RFQ intake (manual entry)
- Packaging database (linked, separate)
- Manufacturing cost centers
- Dashboard with key metrics
- User authentication (admin role)

### Out of Scope (Phase 1)
- Powders, stick packs, liquids, gummies, softgels
- Fast-dissolving tablets
- AI-powered RFQ email parsing (Phase 2)
- Inventory/lot tracking (Phase 2)
- Multi-currency (USD only)
- Shipping calculations
- Approval workflows
- Customer-facing portal
- Mobile app

---

## 5. Functional Requirements

### FR-1: Ingredient Master Database

**FR-1.1:** System shall store 2,567+ ingredients with 23 fields per record including: RM ID, name, scientific name, category, subcategory, supplier, cost/kg, assay %, **Active Content %**, label claim active, multi-component flag, base overage %, base wastage %, and dosage-form-specific overage/wastage (capsule, tablet, powder, stick pack).

**FR-1.2:** System shall distinguish between Active Content % (used for calculations) and Assay % (specification compliance only).

**FR-1.3:** System shall support multi-supplier ingredients — same ingredient from different suppliers at different prices. System auto-selects optimal supplier; user can override.

**FR-1.4:** System shall flag ingredients with "Internal Database" supplier as "Estimated — Verify Before Sending" in generated quotes.

**FR-1.5:** System shall support ingredient search by name, category, subcategory, function, and RM ID with fuzzy matching.

**FR-1.6:** System shall store multi-component ingredient breakdowns (e.g., Magnesium Citrate = 16% elemental Magnesium + 84% Citrate).

### FR-2: Formulation Engine

**FR-2.1:** System shall calculate adjusted ingredient amounts using the formula:
```
Adjusted Amount (mg) = Label Claim ÷ (Active Content % / 100) × (1 + Overage %)
```

**FR-2.2:** System shall select dosage-form-specific overage and wastage percentages automatically based on ingredient category and selected dosage form (capsule or tablet).

**FR-2.3:** System shall perform capsule feasibility checks:
- Calculate total fill weight (actives + excipients)
- Compare against capsule capacity (Size 1: 400mg, Size 0: 500mg, Size 00: 735mg)
- Support multi-capsule servings (1–6 capsules per serving)
- Report fill percentage and warnings

**FR-2.4:** System shall auto-calculate excipients based on formulation complexity:
- **Standard:** SiO₂ 0.5%, MgSt 0.75%, filler = remainder
- **Moderate:** SiO₂ 0.75%, MgSt 0.75%, filler = remainder
- **High:** SiO₂ 1.0%, MgSt 1.0%, filler = remainder

**FR-2.5:** System shall implement the 4-step ingredient selection algorithm:
1. Match ingredient by name/synonym
2. Optimize assay by dosage form (higher for multi-ingredient capsules, lower for tablets)
3. Cost optimize among matching assay variants
4. Allow manual override via dropdown

**FR-2.6:** System shall support IU-to-mg conversions (Vitamin D3: 1 IU = 0.000025mg, Vitamin E: 1 IU = 0.00067mg).

### FR-3: Pricing Engine

**FR-3.1:** System shall calculate COGS using the hybrid TM503438 cost structure:
- **Part A:** Raw material costs (sum of all ingredient costs with Active Content %, overage, wastage)
- **Part B:** Production costs (blending labor, encapsulation/tableting labor, production waste at 2%)
- **Part C:** Packaging costs (bottles, caps, desiccants, sleeves, labels, cartons, pallets, packaging labor)

**FR-3.2:** System shall generate tiered pricing for 3 MOQ tiers:
- 2K units: 40% margin
- 5K units: 35% margin
- 10K units: 30% margin

**FR-3.3:** System shall display all 3 tiers side-by-side with per-unit and total batch pricing.

**FR-3.4:** System shall apply 15% overhead to (RM + Manufacturing costs).

**FR-3.5:** System shall calculate and display cost per unit, cost per serving, and cost per bottle.

### FR-4: Quote Management

**FR-4.1:** System shall generate professional PDF quotes with:
- Company header (Advanced Supplements LLC, 131 Heartland Blvd, Edgewood, NY 11717)
- Customer details
- Product specification summary
- Formulation details (optional — can be hidden for customer-facing quotes)
- Tiered pricing table (2K/5K/10K side-by-side)
- Terms and conditions
- Validity period (default 30 days)
- Quote number (auto-generated: QT-YYYYMMDD-NNN)

**FR-4.2:** System shall support quote versioning — each revision creates a new version, preserving history.

**FR-4.3:** System shall display quotes on-screen before PDF download.

**FR-4.4:** System shall track quote status: Draft → Sent → Viewed → Accepted → Rejected → Expired.

### FR-5: CRM

**FR-5.1:** System shall manage customers with: company name, contact name, email, phone, address, tier (Premium/Standard/Basic), notes, status (Active/Inactive).

**FR-5.2:** System shall track leads through the NEPQ sales pipeline:
1. Initial Contact
2. Problem Awareness
3. Pain Point Amplification
4. Solution Presentation
5. Commitment

**FR-5.3:** System shall manage opportunities with: customer, title, value, stage, probability (0–100%), expected close date, notes.

**FR-5.4:** System shall display a sales dashboard with: new leads count, active opportunities, quotes sent, total pipeline value, conversion rates.

### FR-6: Packaging Database

**FR-6.1:** System shall maintain a separate packaging materials database with: material ID, name, type (bottle/cap/label/desiccant/sleeve/carton/pallet), size, supplier, base cost, MOQ, lead time.

**FR-6.2:** System shall link packaging to formulas — when a quote is generated, packaging costs are auto-pulled based on bottle size and count.

**FR-6.3:** System shall support volume-based packaging pricing tiers.

### FR-7: Manufacturing Cost Centers

**FR-7.1:** System shall maintain manufacturing cost centers with: cost center name, cost type (labor/equipment/overhead/setup/QA), product format, and costing method (per unit/per hour/per batch/per kg).

**FR-7.2:** System shall use real production rates from TM503438 data:
- Encapsulation: 70,000 caps/hour
- Packaging: 1,300 bottles/hour
- Labor rate: $15/hour
- Production waste: 2% (3% for batches under 1000kg)

### FR-8: Dashboard

**FR-8.1:** System shall display a main dashboard with:
- Key metrics: New RFQs, Active Quotes, Pipeline Value, Closed Deals
- Recent quotes with status
- Sales pipeline visualization
- Quick actions (New Quote, New Customer, Search Ingredients)

---

## 6. Non-Functional Requirements

**NFR-1: Performance** — Quote calculation must complete in <3 seconds for a 20-ingredient formulation.

**NFR-2: Reliability** — 99.5% uptime on Vercel.

**NFR-3: Security** — Role-based access control (Admin role for Phase 1). All data encrypted in transit (HTTPS).

**NFR-4: Scalability** — Must handle 2,567+ ingredients and 100+ concurrent formulation calculations.

**NFR-5: Accuracy** — Pricing calculations must match manual Excel calculations within ±0.5% tolerance. Verified via TDD against known TM503438 production quotes.

**NFR-6: Maintainability** — Clean Architecture with separated domain logic. All business rules in dedicated engine modules, not embedded in UI components.

**NFR-7: Data Integrity** — All price changes, quote versions, and formulation modifications tracked with timestamps.

---

## 7. Success Metrics

| Metric | Current | Target |
|---|---|---|
| Quote generation time | 2–4 hours | <30 minutes |
| Pricing accuracy | Unknown (manual) | ±0.5% of validated benchmarks |
| Quote turnaround to customer | 24–48 hours | Same day |
| Active data sources | 8+ fragmented | 1 unified system |
| CRM tracking | None | Full pipeline visibility |

---

## 8. Technical Constraints

- **Database:** Vercel Postgres (PostgreSQL via Neon)
- **Deployment:** Vercel with GitHub auto-deploy
- **Framework:** Next.js 16 with App Router
- **ORM:** Drizzle ORM
- **Currency:** USD only
- **Phase 1 dosage forms:** Capsules + Tablets only
- **No shipping calculations**
- **Fixed lead time:** "8–12 weeks after batch sheet approval"

---

## 9. Dependencies

- Vercel account with Postgres addon
- GitHub repository (created: `optibiosupplements/optibio-erp`)
- `OptiBio_Master_Ingredients_CLEANED.xlsx` for data seeding
- TM503438 production quotes for pricing validation
- Anthropic Claude API key (for future AI features)

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Active Content % data quality for 2,024 "Internal Database" entries | Inaccurate quotes | Flag as estimated; verify with real suppliers over time |
| Formulation complexity exceeding capsule capacity | User confusion | Clear feasibility checks with upgrade suggestions |
| Pricing engine bugs | Financial loss | TDD with validation against 5+ known production quotes |
| Scope creep into Phase 2 features | Delayed delivery | Strict Phase 1 scope enforcement via BMAD stories |

---

## 11. Release Plan

### Phase 1 (Current) — Core ERP
- Ingredient database + formulation engine + pricing engine + PDF quotes + CRM + dashboard
- Target: Production-ready MVP

### Phase 2 (Future) — Automation
- AI-powered RFQ email parsing
- Inventory/lot tracking
- Powder/stick pack/gummy support
- Customer self-service portal
- Advanced analytics and reporting

### Phase 3 (Future) — Scale
- Multi-user with role-based permissions
- Integration with Shopify store
- Purchase order generation
- Batch record management
- COA tracking and validation
