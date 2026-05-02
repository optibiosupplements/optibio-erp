# Optibio ERP Builder Ethos

Adapted from gstack's ETHOS for our specific business: a one-person nutraceutical brokerage replacing a 13-attempt sprawl of half-finished apps with one production tool.

---

## 1. Boil the Lake (in our context)

Cheap to ship the complete flow with AI. Don't half-finish features — half-finished is what got us 13 dead repos.

- **Lake:** A complete RFQ→Quote→PDF flow with all 6 Phase-1 features wired up. Boil it.
- **Ocean:** A multi-tenant SaaS version with billing and customer self-service. Out of scope until Phase 3.
- Anti-pattern: shipping the Magic Box without the parser, or the parser without the seed data, or the seed data without the schema migrations.

## 2. Real data, real customers, real tests

We have 13 prior attempts because each one was built against fake data and demo customers. **Never again.**

- Master data is seeded from `data/OptiBio_Master_Ingredients_CLEANED.xlsx` + Desktop NUTRA ERP master sheets. ~2,567 ingredients.
- Regression tests use real customer RFQs we've already quoted: Asher Elderberry/Beet/Berberine/Magnesium, Joe Hydration (out-of-scope routing test).
- The ship gate: our generated quote for Asher Elderberry @ 2K bottles must match the real $7.90/bottle figure within ±10%. If it doesn't, the pricing engine isn't done.

## 3. Two AI personas, two boundaries

Eva and Danny do different jobs. Don't blur them. Eva talks to humans about RFQs and customers. Danny does GMP-compliant bench formulation. If Eva starts trying to size capsules, or Danny starts asking about the customer's email, fix the prompt.

## 4. Phase 1 scope discipline

Capsules + tablets only. No powders, no stick packs, no gummies, no softgels, no ODT — even if a real customer asks. Route them to manual quoting until Phase 2.

The reason: 13 repos failed because scope expanded faster than capability. We protect Phase 1 ruthlessly.

## 5. Pre-existing work is a feature, not a liability

`supplement-quote-app26` already has a working ingredient parser, capsule quote engine, excipient calculator, CRM, RFQ flow, and 14 unit tests. Port it. Don't rewrite.

## 6. Plan files over commit-message checkpoints

`supplement-quote-app26` had 30+ "Checkpoint:" commits. None of them tell the story. Every non-trivial change in this repo gets `/autoplan` first; the plan file ships in the PR description.

## 7. Decisions belong in the repo, not in conversation

When we make a non-obvious decision (e.g. "ditch powder format from Phase 1", "use Active Content % not Assay %", "RFQ created before parser runs"), it goes in `ARCHITECTURE.md` or the relevant code comment. Future-you and future-Claude need it.

## 8. The ship gate is real Asher pricing

Until our generated Asher Elderberry quote matches reality within ±10%, the pricing engine is broken — no matter how green the unit tests are. Calibrate margin/overhead/manufacturing/packaging until the canonical case matches.
