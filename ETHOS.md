# Optibio ERP Builder Ethos

Adapted from Garry Tan's `gstack` ethos for our specific domain: a one-operator
nutraceutical brokerage replacing a 13-attempt sprawl of half-finished apps with
one production tool. cGMP-bound. Real customers. Real money.

---

## 1. Boil OUR Lakes

AI makes completeness cheap. Don't half-finish features — half-finished is what
gave us 13 dead repos.

A "lake" in our domain is something AI can boil end-to-end in minutes:
- Schema migration + seed data + UI + API + tests for one entity
- Excel exports for a release document with all 5 NS-USA-style sheets
- Real-customer regression fixtures from `0. WORK/1.CUSTOMERS/`

An "ocean" is everything else:
- Multi-tenant SaaS with billing (out of scope)
- Customer portal with self-service quoting (Phase 4+)
- Multi-currency, multi-site, multi-language (post-IPO)

**Rule:** When the difference between 70% and 100% is 5 minutes — always 100%.
When it's 5 hours — explicitly defer with a TODO.

---

## 2. Real Data, Real Customers, Real Tests

We have 3,081 ingredients seeded from your master sheet. We have 5 real
customers (Asher, Joe, Lin+Jeremy, HGW, Pedialyte) with real folder histories
on Desktop. We have a canonical NS-3318C COA template.

**Rule:** Never demo with mock data. Every feature gets exercised against real
customer data before merge. Asher Elderberry @ 2K bottles is the canonical
ship-gate.

---

## 3. Two AI Personas, Two Boundaries

**Eva** = Intake & CRM specialist. Talks to humans about RFQs and customers.
Lives in `src/components/deal/EvaChat.tsx` + `src/app/api/agent/route.ts`.

**Danny** = Bench formulator. GMP-compliant. Sizes capsules, computes excipients,
flags manufacturability risks. Lives in `src/domains/agents/danny.formulator.ts`.

**Rule:** Don't blur their roles. If Eva starts sizing capsules, or Danny starts
asking about customer email — fix the prompt.

---

## 4. The Six SMEs Review Every Non-Trivial Plan

Garry uses 4 (CEO, Eng, Design, DevEx). For nutra ERP we add **Operations**
(factory-floor reality) and **Regulatory/QA** (21 CFR 111 compliance).

| Role | Lens |
|---|---|
| 🎩 **CEO** (Panna's revenue voice) | Does this close more sales? Does it widen margins? |
| 🔧 **Eng Manager** | Schema integrity. Performance. Edge cases. Type safety. |
| 🎨 **Designer** | High-density B2B. Tabular data. No 1990s Excel UI. |
| 🏭 **Operations** | Factory floor — lot traceability, batch records, inventory accuracy |
| 📋 **Regulatory/QA** | 21 CFR 111. Amazon compliance. ISO 17025. Append-only COAs. |
| 🛒 **Customer** | What does Asher / Joe see? Can they prove provenance? Can they reorder? |

**Rule:** Every PR larger than 50 LOC gets a panel review in
`docs/PHASE-N-PLAN.md` BEFORE the code is written. See `docs/REVIEW-PROCESS.md`.

---

## 5. Search Before Building (3 Layers)

Garry's three layers, applied to OptiBio:

**Layer 1 — Tried and true (don't reinvent).** Drizzle, Postgres, Next.js,
Anthropic SDK, xlsx library, USP standards, FDA cGMP rules. We didn't write a
formulation engine from scratch — we ported `supplement-quote-app26`'s tested
parser + sizer + excipient calc.

**Layer 2 — New and popular (scrutinize).** Vercel AI SDK, Drizzle Studio,
shadcn/ui patterns. Use them but verify they survive our specific use cases
before going wide.

**Layer 3 — First principles (prize above all).** When industry "best practice"
contradicts what's actually true for your business — name it. Examples we've
already booked:
- "Phase 1: Capsules + Tablets only" (PRD discipline beats feature creep)
- "RFQ created BEFORE parser runs" (never block the user)
- "Active Content %, never Assay %" (the prior 8 attempts had this wrong)
- "COAs are append-only after sign" (21 CFR 111 + sane regret-recovery)

When you make a Layer 3 decision, write it in `ARCHITECTURE.md` invariants
section. Future-you (and future-Claude) need the *why*.

---

## 6. Phase 1 Scope Discipline

Capsules + Tablets + Powder. Stickpacks/Gummies/Liquids/Softgels/ODT route to a
"format not yet supported" warning even when a real customer asks. **The reason
13 prior repos failed: scope expanded faster than capability.**

When Joe (real customer) asks for stickpacks — we say "Phase 2." We do not
quietly add gummy support. We protect Phase 1 ruthlessly.

---

## 7. Plans Over Checkpoint Commits

`supplement-quote-app26` had 30+ "Checkpoint:" commits. None of them tell the
story. Every non-trivial change here gets a `docs/PHASE-N-PLAN.md` first. The
plan is the PR description. Future-you reads it; future-customers don't see it.

---

## 8. Decisions Belong in the Repo

When you make a non-obvious choice — write it down where future-you will find
it without searching:
- Architectural decisions → `ARCHITECTURE.md` invariants
- Cross-session learnings → `docs/LEARNINGS.md`
- Feature plans → `docs/PHASE-N-PLAN.md`
- One-off comments only when the *why* would surprise a reader

The conversation history disappears. The repo is forever.

---

## 9. The Ship Gate Is Real Asher Pricing

Until our generated Asher Elderberry quote @ 2K bottles matches reality
(~$7.90/bottle) within ±10%, the pricing engine is broken — no matter how green
the unit tests are. Calibrate margin/overhead/manufacturing/packaging until the
canonical case matches.

Same principle for every feature: there is a canonical real-world case it must
satisfy before merge. List it in the plan doc.

---

## 10. Continuous Improvement Loop

After every shipped feature:
1. `/document-release` — update `CHANGELOG.md`, `ARCHITECTURE.md`, `TODOS.md`
2. Update `docs/LEARNINGS.md` if anything non-obvious was discovered
3. Weekly: open `/retro` in the app, review the KPI deltas

**The point of doing all this is to do less of it next time.** Every learning
captured today is a question you don't answer twice.
