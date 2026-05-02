# Phase 5 — Customer-Facing PDFs (Quotes + Invoices)

> First plan written under the new SME panel process from `docs/REVIEW-PROCESS.md`.

## Context

Internal Excel exports already work end-to-end. But Excel is not how Asher /
Joe / Lin send quotes to *their* downstream customers, attach to RFP responses,
upload to Amazon Brand Registry. They want PDFs:
- **Quote PDF** — clean, branded, single-page, valid 30 days
- **Invoice PDF** — professional, with payment instructions, ACH details

Excel exports stay (Panna uses them internally as working sheets). PDFs are
the customer-facing artifact.

---

## Canonical real-world test case

Asher Elderberry 500mg Capsule, 60ct bottle, 2K/5K/10K tiers. The quote PDF
must:
1. Open in Acrobat Reader without errors
2. Print on US Letter cleanly with 0.5" margins
3. Include OptiBio header (later: NUTRA SOLUTIONS USA branding) with our address
4. Show product spec, all 3 tiers with batch totals, validity, scope/exclusions
5. Match the look-and-feel of the Asher Price Quote 12.31.25 docx that
   exists in `Desktop/0. WORK/1.CUSTOMERS/ASHER/NEW RFQ/`

Same drill for the invoice PDF — must look like an invoice a real CFO would
process. Net-30 terms, payment instructions, line items with PO reference.

---

## SME Panel Verdicts

### 🎩 CEO — Revenue Lens
**Verdict:** Critical. Excel quotes lose deals. Customers want a PDF they can
forward, attach, archive. Not having branded PDFs is one of the top reasons
customers ghost after a verbal interest. Build it. The 10-star version: a
single click on `/quotes/[id]` produces a PDF identical in form to what Panna
manually drafts in Word today.

### 🔧 Eng Manager
**Verdict:** Use `pdfkit` (already a dep). Generate server-side at request
time, no caching needed (quotes are small enough). Mirror the existing
`/api/quotes/[id]/xlsx` structure: `/api/quotes/[id]/pdf`. Don't bring in
React-PDF — it has hydration issues and we don't need React semantics in a
print document.

Two endpoints:
- `/api/quotes/[id]/pdf`
- `/api/invoices/[id]/pdf`

Shared header/footer renderer in `src/domains/pdf/branding.ts`.

### 🎨 Designer
**Verdict:** This is a print document, not a web page. Different rules:
- 11pt body, 14pt section headers, 18pt title
- Black text on white. Brand red `#d10a11` for borders/accents only.
- Tabular layout — fixed columns, right-aligned numbers
- Single page where possible. Multi-page only when ingredient count >12.
- No emojis. No fancy fonts. Helvetica.
- Footer: small, gray, with our address + page X of Y

Reference: `Desktop/Quotation/HGW Quote.xlsx` and the Asher Price Quote docx
for the visual target.

### 🏭 Operations
**Verdict:** PDFs are read-only outputs of existing data — no new operational
risk. But: include the formulation ID and quote ID as small footer text so
when a customer emails asking about a year-old quote, we can find it.

### 📋 Regulatory/QA
**Verdict:** Quotes/invoices are not regulated documents per 21 CFR 111. But
they DO show ingredient claims that must be truthful per FDA general
labeling rules. Two safeguards:
- Disclaimer: "This document is a price quote. Final product specifications
  subject to formulation review and bench testing. Label claims pending
  COA per 21 CFR 101.9(g)."
- "Estimated price" badge if any ingredient has `is_estimated_price = true`
  in the database (these are placeholder costs).

### 🛒 Customer (Asher)
**Verdict:** Asher uploads our quote into his CRM. He needs:
- His company name on the doc, not "—"
- His PO# on the doc if he gave one
- Tier table (2K/5K/10K) clearly comparable
- Per-bottle pricing for each tier
- Lead time + validity
- Our contact info if he wants to call/email

Same for invoices: PO ref, due date, ACH instructions, remittance address.

---

## Implementation Plan

### New files

```
src/domains/pdf/branding.ts          - Shared header / footer / page setup helper
src/domains/pdf/quote.ts             - Quote PDF builder
src/domains/pdf/invoice.ts           - Invoice PDF builder
src/app/api/quotes/[id]/pdf/route.ts - Already exists; rewrite to use new builder
src/app/api/invoices/[id]/pdf/route.ts - New
```

### UI changes

```
src/app/(dashboard)/quotes/[id]/page.tsx   - Wire "Download PDF" button
src/app/(dashboard)/invoices/[id]/page.tsx - Add "Download PDF" + "Send Invoice"
```

### Schema changes

None.

### Branding constants

`src/domains/pdf/branding.ts` exports:
- `MANUFACTURER` (already in `src/domains/coa/standards.ts` — re-use)
- `PDF_COLORS = { red: "#d10a11", text: "#0F172A", muted: "#64748B" }`
- `PDF_FONTS = { body: "Helvetica", bold: "Helvetica-Bold" }`
- `header(doc, title)` — renders the top band
- `footer(doc, refId, page, totalPages)` — renders the bottom band

### Estimated effort

90 minutes. Quote PDF: 45 min. Invoice PDF: 30 min. Wiring + testing: 15 min.

---

## Verification

1. Save a quote with the Asher Elderberry formula. Click "Download PDF" on
   `/quotes/[id]`. Open in Acrobat. Check that:
   - All 3 tiers visible
   - "Asher Brand" appears as customer (not "—")
   - "EST" badge does NOT appear (production formula, real ingredients)
   - Single page
   - Footer has quote # + "Page 1 of 1"

2. Create an invoice from the same PO. Click "Download PDF". Check:
   - Customer name + remit-to block
   - Line items include "(PO PO-2605-0001)"
   - Total + tax + balance due
   - Net-30 terms displayed
   - Footer has invoice # + page numbers

3. After both pass: a fresh-eyes pass — show to Panna, confirm "could you
   send this to Asher right now?"

---

## Out of scope (Phase 5+ ideas)

- Email-the-PDF feature (requires SMTP + email templates)
- Custom branding upload (logo, address change in settings)
- Multi-language PDFs
- Customer-portal access to download their own PDFs
- Watermarked draft / void status PDFs
