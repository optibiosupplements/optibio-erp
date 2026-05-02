# Browser config — for `/qa` and `/browse`

This is what gstack's `/qa` skill reads to know how to drive a real Chromium against this app.

## Local dev

- **URL:** `http://localhost:3000`
- **Start:** `pnpm dev` (from repo root)
- **Default landing:** `/` (dashboard)

## Sidebar smoke test routes

`/qa` should click through each of these and assert a 200 + visible content:

- `/` — Dashboard
- `/pipeline` — Sales pipeline
- `/intake` — RFQ list
- `/intake/new` — Magic Box (the most important screen)
- `/formulations` — The Lab
- `/quotes` — Quote queue
- `/quotes/new` — New quote workspace
- `/customers` — Customer list
- `/suppliers` — Supplier list
- `/ingredients` — Ingredient master DB (must have ≥100 rows once seeded)
- `/packaging` — Packaging materials
- `/settings` — Settings

## Magic Box golden-path test

1. Navigate to `/intake/new`.
2. Find the textarea labeled "Paste your formula or inquiry text".
3. Paste exactly: `Elderberry 10:1 500mg + Vit C 90mg + Vit D 1000 IU + Zinc 11mg`
4. Click the button labeled "Analyze & Auto-Fill".
5. Assert: a toast appears within 1 second containing the text `RFQ-` followed by 4 digits, a hyphen, and 4 more digits.
6. Assert: the format selector now reads "Capsule".
7. Assert: an ingredient table appears with exactly 4 rows. Row 1: name="Elderberry", amount="500", unit="mg", notes contains "10:1". Row 2: name="Vit C" or "Vitamin C", amount="90", unit="mg". Row 3: name contains "Vit D", amount="1000", unit="IU". Row 4: name="Zinc", amount="11", unit="mg".
8. Assert: the "Submit to R&D" button is enabled.
9. Click "Submit to R&D".
10. Assert: navigation to `/intake/[id]` and status badge reads "In Review" or "Formulating".

## Submit-gate negative tests

- With empty intake: "Submit to R&D" button must be **disabled**.
- With format selected but no ingredients: button **disabled**.
- With ingredients but no format: button **disabled**.
- With format + 1 ingredient (and no customer info): button **enabled**.

## Out-of-scope routing test (Joe Hydration)

1. Navigate to `/intake/new`.
2. Paste: `Hydration Stickpack — 8.5g serving — Dextrose, Sodium Chloride, Potassium Citrate, Citric Acid, Sodium Citrate, Natural Fruit Punch Flavor`
3. Click Analyze.
4. Assert: a non-blocking warning banner appears: "Stick packs are not supported in Phase 1 — quote manually."
5. RFQ should still be created (status=Draft), but the Submit-to-R&D button should be **disabled** with a tooltip explaining why.

## Auth (Phase 2)

Phase 1 is single-user (Panna). No login required locally. When auth ships:
- Login URL: `/login`
- Demo creds: see `.env.local` (do not commit).
- Use `/setup-browser-cookies` to import a real Chrome session for authenticated QA.

## Things `/qa` should NOT do

- Do not delete RFQs, quotes, or formulations — they're how we test regressions.
- Do not click "Send Quote" buttons that hit external email APIs.
- Do not test packaging-supplier email integrations against live SMTP.
- Do not run against the production deploy. Local-only or Vercel preview only.
