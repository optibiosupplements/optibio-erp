# Learnings

Cross-session institutional knowledge. The point of this file: every question
answered here is one we don't have to re-discover.

Adapted from Garry Tan's `gstack` ETHOS principle "Eureka — when first-principles
reasoning contradicts conventional wisdom, name it and log it."

Add an entry whenever something surprised you, took >5 minutes to figure out, or
contradicted a prior assumption. Date stamps mandatory.

---

## 2026-05-02 — Botanicals don't divide by Active Content %

**Conventional wisdom:** Always use Active Content % to compute adjusted mg.
**Reality for botanicals:** "Elderberry 10:1" means the EXTRACT is 10:1 dried
weight equivalent. The label claim 500mg refers to the extract weight, not
the equivalent. Dividing by 10% = adding 5500mg of extract to a 700mg cap.

**Fix:** For category=Botanical, label_claim is the actual mg of extract.
The "10:1" is a descriptive ratio, not a divisor. Active Content % should be
100 for the formulation calc to work.

**Affected files:** `src/domains/pricing/pricing.engine.ts`

---

## 2026-05-02 — RFQ creation must NEVER block on parsing

**Conventional wisdom:** Validate the form, then save.
**Reality:** Parsing customer inquiries is fuzzy. If a paste doesn't parse, the
RFQ still needs to exist so Sales can fix the formula and not lose the
context.

**Fix:** `POST /api/intake` always creates the row first, returns the ID,
then runs the parser. Parsing failures surface as helper text, not blocking
errors.

**Affected files:** `src/app/api/intake/route.ts`,
`src/app/(dashboard)/intake/new/page.tsx`

---

## 2026-05-02 — Pricing engine had per-cap vs per-bottle unit mismatch

**Conventional wisdom:** "COGS per unit" is unambiguous.
**Reality:** Our pricing engine summed RM cost (per cap) + Manufacturing labor
(per bottle) + Packaging (per bottle) as if they're the same unit. The Asher
Elderberry quote came out at $1.62/bottle vs the real $7.90.

**Fix (pending):** Multiply RM cost by capsules-per-serving × servings-per-bottle
before adding to packaging/manufacturing. OR: store everything per-bottle and
divide RM by 60.

**Affected files:** `src/domains/pricing/pricing.engine.ts` (TODO)

---

## 2026-05-02 — Vercel auto-creates a separate Neon DB per project

**Conventional wisdom:** "I set DATABASE_URL once, it's the same DB everywhere."
**Reality:** When Vercel + Neon were first wired (37 days ago), Vercel created a
separate Neon DB and stored its URL as `DATABASE_URL` in production env. Local
dev was a different DB.

**Fix:** Use `vercel env pull .env.production` to grab the prod URL, then run
`db:push` and seed scripts against BOTH.

**Affected files:** `scripts/seed.ts`, `scripts/seed-customers-suppliers.ts`,
`drizzle.config.ts`

---

## 2026-05-02 — Next.js 16 requires Suspense around `useSearchParams`

**Conventional wisdom:** Mark a component `"use client"` and you're done.
**Reality:** Next.js 16 prerenders client components for static analysis.
`useSearchParams()` will fail prerender unless wrapped in `<Suspense>`.

**Fix:** Wrap any page using `useSearchParams` in `<Suspense fallback={...}>`
at the page-level export.

**Affected files:** `src/app/login/page.tsx`,
`src/app/(dashboard)/formulations/new/page.tsx`,
`src/app/(dashboard)/quotes/new/page.tsx`

---

## 2026-05-02 — gstack mass-archive blocked by sandbox

**Conventional wisdom:** "User said 'archive 11 repos' = harness allows it."
**Reality:** The harness flags batch external-system writes as high-severity
even when the user generally approved a plan. Per-repo confirmation needed.

**Fix:** For mass operations on shared resources, ask explicit "go" right
before the operation. Don't try to bundle.

---

## 2026-05-02 — APP_PASSWORD env var disables auth gracefully

**Conventional wisdom:** "Auth is on or off, no in-between."
**Reality:** Our middleware checks `APP_PASSWORD`. If unset, the app is fully
open. Useful for dev, dangerous if it ships to a public URL without setting
the env var.

**Fix:** The login page itself indicates when the gate is open. The deploy
checklist must include "is APP_PASSWORD set in Vercel env?" before sharing
the URL.

**Affected files:** `src/middleware.ts`, `src/app/login/page.tsx`

---

## Template for new entries

```markdown
## YYYY-MM-DD — One-line title

**Conventional wisdom:** What you'd assume.
**Reality:** What's actually true and the evidence.

**Fix:** What we did about it.

**Affected files:** `path/to/file.ts`
```
