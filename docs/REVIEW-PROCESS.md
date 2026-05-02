# Review Process — How We Build

This is the operating system for changes to optibio-erp. Adapted from Garry
Tan's `gstack` workflow. Every change follows this loop.

```
Plan → SME Panel → Code → Self-review → QA → Ship → Document → Retro
```

---

## 1. Plan (before any non-trivial code)

For changes >50 LOC or any new schema/API/UI:

1. Create `docs/PHASE-N-PLAN.md`
2. Write 1-paragraph **Context**: what gap does this close?
3. Identify the **canonical test case** (real customer data preferred)
4. Run the SME panels relevant to the change (see `docs/SME-PANELS.md`)
5. Write the implementation plan (file paths, schema changes, API routes, UI)

---

## 2. SME Panel Review

Every non-trivial change passes through 2-6 of these:

🎩 CEO — does this close revenue gaps?
🔧 Eng — does this hold up at scale?
🎨 Designer — does this match `DESIGN.md`?
🏭 Operations — full lot traceability?
📋 Regulatory — 21 CFR 111 compliant?
🛒 Customer — what does Asher see?

Output goes in the plan file. The PR description links to the plan.

---

## 3. Code

- Boil the lake (do the complete thing, don't half-ship)
- Search before building (Layer 1 → Layer 2 → Layer 3)
- Match existing patterns in `src/app/api/*/route.ts`,
  `src/app/(dashboard)/*/page.tsx`
- Run `pnpm exec tsc --noEmit` continuously while editing

---

## 4. Self-review

Before committing:

- [ ] `pnpm exec tsc --noEmit` exits 0
- [ ] `pnpm build` exits 0
- [ ] No `any` types added
- [ ] No `console.log` debug noise
- [ ] No commented-out code blocks
- [ ] Schema changes pushed to BOTH dev + prod Neon DBs
- [ ] Tests added (or explicitly deferred with TODO)
- [ ] `CHANGELOG.md` updated (or skip note added if not user-visible)

---

## 5. QA — Real Browser, Real Data

For UI changes:

1. `pnpm dev` locally + login + walk the new flow as the user would
2. Test the **canonical real-world case** from the plan
3. Test edge cases the SME panel flagged
4. For shipped UI changes also test in production after deploy

For API changes: smoke-test with curl + login cookie against both dev (local)
and prod (https://optibio-erp.vercel.app).

---

## 6. Ship

```bash
git add -A
git commit -m "feat(area): one-line summary

Body explains WHY (not WHAT — that's the diff). Reference the plan file.

Co-Authored-By: ..."
git push origin main
```

Vercel auto-builds + deploys. Watch the build status:
```bash
gh api "repos/optibiosupplements/optibio-erp/commits/$(git rev-parse HEAD)/statuses" \
  --jq '.[0].state'
```

If `failure`: pull the build log via `npx vercel inspect <dpl_id> --logs`,
fix, re-push.

---

## 7. Document the Release

After deploy succeeds:

- Update `CHANGELOG.md` with the user-visible changes
- Update `TODOS.md` (mark P0 done, surface new follow-up TODOs)
- Update `ARCHITECTURE.md` if a new invariant was introduced
- Add to `docs/LEARNINGS.md` if anything non-obvious was discovered
- Smoke-test the same routes in production as you tested locally

---

## 8. Retro (weekly)

Open `/retro` in the app. Look at:
- KPI deltas vs. last week
- What shipped (commit count, modules added)
- What broke (build failures, bug fixes)
- What surprised us (additions to LEARNINGS.md)

Capture anything systemic that should change about the process itself.

---

## Failure Modes & Their Fixes

| Symptom | Likely fix |
|---|---|
| "We shipped X but Panna doesn't use it" | CEO panel got skipped. Re-run with revenue lens. |
| "FDA would reject this" | Regulatory panel got skipped. Add the missing fields. |
| "The UI is unusable" | Designer panel got skipped. Re-run, fix density + color. |
| "Customer can't find their COA" | Customer panel got skipped. Add the navigation step. |
| "Schema migration broke prod" | Eng panel skipped `drizzle-kit generate` step. Always generate before prod cutover. |
| "I keep writing the same SQL twice" | Add to `docs/LEARNINGS.md`. Build a helper. |

---

## What This Is Not

- **Not a gate** — for trivial changes (typos, dep bumps, single-line fixes),
  skip the panel and ship.
- **Not bureaucracy** — the panel is 5 short paragraphs in a markdown file.
  It exists to catch the obvious-in-hindsight before code is written.
- **Not waterfall** — iterate fast within the panel verdicts.
