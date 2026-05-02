# SME Panels — The Six Reviewers

Adapted from Garry Tan's `gstack` 4-panel review (CEO / Eng / Design / DevEx)
to a 6-panel review fit for a cGMP-bound nutraceutical ERP.

Every non-trivial change runs through this panel BEFORE code is written.
Output goes in `docs/PHASE-N-PLAN.md`. The PR description references the
plan file.

---

## 🎩 CEO — Revenue Lens (Panna's voice)

**Question:** Does this make me ship quotes faster, close more deals, or
widen margins? If it doesn't, why are we building it?

**Forcing prompts:**
- What's the 10-star version of this? (per Garry — find the dream)
- What customer just had to wait too long? Does this fix that?
- What's the 5-second pitch I'd give a buyer for why this exists?

**Red flags:**
- "Nice to have" features without a customer pulling for them
- Building infrastructure when we're missing user-facing value
- Anything that adds steps to the existing flow

**Greenlight:** Closes a known gap (calibration, Asher quote turnaround,
COA delivery to Amazon, etc.) OR enables a new capability with named
customer demand.

---

## 🔧 Eng Manager — Architecture Lens

**Question:** Will this code still be debuggable in 6 months? Does the schema
hold up under 100x scale? Where does it leak?

**Forcing prompts:**
- New tables? UUID PKs, FK cascades on parent delete, indexes on queryable cols
- Migrations? Use `drizzle-kit generate` for prod, never just `db:push`
- API routes? Match the patterns in existing `/api/*/route.ts` (force-dynamic,
  consistent error shape, allowlist for PATCH fields)
- Server vs client component split: server for data, client for interactivity
- Type safety? `pnpm exec tsc --noEmit` exits 0
- Build passes? `pnpm build` exits 0

**Red flags:**
- New tables without thinking about FK cascade
- Mutations in server components
- `any` types
- "I'll add tests later"

**Greenlight:** Schema fits the existing model. Type-check + build clean.
Edge cases enumerated.

---

## 🎨 Designer — Visual Lens

**Question:** Does this match `DESIGN.md`'s high-density B2B style? Does it
respect the 18-module sidebar? Will Panna actually want to look at it?

**Forcing prompts:**
- Numeric columns: tabular-nums + right-aligned?
- Status pills: bg-color-100 text-color-700 pattern?
- Brand red `#d10a11` only for primary CTAs?
- Tables vs cards: tables for lists, cards for summaries?
- Empty states: friendly + actionable, not blank?

**Red flags:**
- `gap-8` or `p-8` (too much whitespace for B2B density)
- `rounded-2xl` (banned everywhere except status pills + avatars)
- Cards used for list items (use tables instead)
- Custom colors outside the design system

**Greenlight:** Matches `DESIGN.md`. Empty states show a CTA. Tables have
sensible status pills. Sidebar still has all modules visible.

---

## 🏭 Operations — Factory-Floor Lens

**Question:** Can the operator actually trace a customer complaint back to
a raw material lot? Will the system survive a real production day?

**Forcing prompts:**
- Lot traceability: every finished bottle → production run → raw material
  lots → supplier COAs?
- Batch records append-only? (You can't delete history.)
- Lot movements logged for every receipt / issue / disposal?
- ID generation collision-free under concurrent load?
- Status workflows clear and one-way (no skip-ahead, no back-step without notes)?

**Red flags:**
- Edit/delete on a closed lot
- Production run without a formulation FK
- COA without a lot FK
- Any UI that lets you change a lot number after issue

**Greenlight:** Full traceability chain intact. Status workflows enforced.
Append-only where the law requires it.

---

## 📋 Regulatory/QA — 21 CFR 111 Lens

**Question:** Does this meet 21 CFR Part 111 (cGMP for dietary supplements)?
Will Amazon's Brand Registry accept the COA we generate? Will an FDA inspector
find a hole?

**Forcing prompts:**
- COAs append-only after QA release? Revisions create new rows referencing
  the superseded COA?
- Test results have spec range, result, method, status (Pass/Fail/OOS)?
- Three signatures required: QC Analyst, QC Manager, QA Release?
- Heavy metal limits per Prop 65 / USP <2232>? Microbial per USP <2021>/<2022>?
- Spec ranges per ingredient comply with 21 CFR 101.9(g)(4)(i) (≥100% LC)?
- Lab accreditation cited (ISO 17025:2017)?

**Red flags:**
- Editable COA after release
- Missing method or accreditation
- Heavy metal limits per gram instead of per daily dose
- "Approved for Release" disposition without all 3 signatures

**Greenlight:** All required fields, all required citations, append-only
flow, real test methods (HPLC, ICP-MS, USP plate count) per category.

---

## 🛒 Customer — End-User Lens (Asher / Joe / Lin)

**Question:** What does Asher see when he opens his bottle and looks for the
COA? Can he prove provenance to Amazon? Can he reorder this exact formula
in one click?

**Forcing prompts:**
- Quote PDF: branded, professional, valid 30 days, tier table clear?
- COA Excel: matches NS-3318C canonical layout? Includes our address + ISO?
- "My PO #" field for their internal system?
- Customer detail page: their POs, COAs, lifetime revenue at a glance?
- Reorder: from a past formulation, one click → new RFQ at that spec?

**Red flags:**
- Customer info missing from outbound docs
- No ship-date visibility
- No way to reach a previous COA
- Generic Excel headers (no NUTRA SOLUTIONS branding)

**Greenlight:** Customer can answer "where's my order, where's the COA, how
do I reorder" without calling Panna.

---

## When the Panel Fires

| Trigger | Required panels |
|---|---|
| New schema table | All 6 |
| New API route | Eng + Operations + Regulatory (if it touches COA/lot/batch) |
| New UI page | CEO + Designer + Customer |
| Calibration / pricing change | CEO + Eng + Customer |
| Bug fix < 50 LOC | None — just `/review` before push |
| Design polish only | Designer |
| New AI agent prompt | CEO + Regulatory (truthfulness) |

---

## How to Run a Panel

1. Start a `docs/PHASE-N-PLAN.md` file
2. Write 1-paragraph context
3. List the panels that should review (per the trigger table)
4. For each: write **Verdict** (1-3 sentences in their voice)
5. Write the implementation plan
6. List the **canonical real-world test case** that must pass
7. Then write the code

The plan file becomes the PR description. The panel verdicts become future-you's
context for "why did we build it this way?".

---

## Anti-Pattern: Solo "Eng-Only" Build

If you only checked through the Eng Manager lens, you have likely:
- Built infrastructure no customer pulled for
- Skipped a regulatory requirement
- Made the UI dense to the point of unusability for Panna
- Missed the customer's actual question

The panel exists to catch this BEFORE code is written. Run it.
