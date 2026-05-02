# Design System — Optibio ERP

This is a high-density B2B internal tool, not a consumer app. Function-first. Sales staff and the operator (Panna) need to move fast.

Adapted from `supplement-quote-app26/PROJECT_RULES.md` (the "Manus Project Constitution") to apply going forward in this repo.

## Product Context

- **What this is:** Internal ERP/CRM for a one-operator nutraceutical brokerage (NUTRA SOLUTIONS USA). Replaces 8 spreadsheets and 13 abandoned app attempts.
- **Who it's for:** Panna (operator), occasional sales/ops collaborators. Not customer-facing in Phase 1.
- **Space:** Manufacturing ERP — peers are NetSuite, Odoo, Monday.com (but lighter, faster, vertical-specific).
- **Aesthetic:** "Professional ERP, not consumer app." Compact, data-dense, neutral chrome with one accent for primary actions.

## Visual System: High-Density B2B

### Spacing
- **ULTRA-COMPACT.** `gap-2` or `gap-3` is the default. `gap-4` for major section separation. **Avoid `gap-8`** or larger.
- Card padding: `p-4` or `p-5`. **Avoid `p-8`** or larger.
- Page padding: `px-6 py-5` for the main content area.

### Corners
- `rounded-md` (6px) or `rounded-lg` (8px) only. Buttons and inputs: `rounded-md`. Cards: `rounded-lg`.
- **BANNED:** `rounded-2xl`, `rounded-3xl`, `rounded-full` (except avatars and pill-status badges).

### Typography
- **Display/Page Titles:** `text-2xl font-bold text-gray-900` (24px).
- **Section Headers:** `text-base font-semibold text-gray-800` (16px) or `text-sm font-semibold` (14px) for sub-sections.
- **Body / Form Labels:** `text-sm text-gray-700` (14px). Field labels: `text-xs font-medium text-gray-600 uppercase tracking-wide`.
- **Data / Tables:** `text-sm` for cells. Numeric columns get `font-mono tabular-nums text-right`.
- **Code / IDs (RFQ-YYMM-####, RM00xxx):** `font-mono text-sm text-gray-900`.
- **Captions / Helper:** `text-xs text-gray-500`.

### Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Background | `bg-slate-50` / `bg-gray-50` | `#F8FAFC` | App background |
| Card surface | `bg-white` | `#FFFFFF` | Cards, modals, table headers |
| Border (default) | `border-slate-200` | `#E2E8F0` | Card borders, table dividers |
| Border (input) | `border-slate-300` | `#CBD5E1` | Form inputs |
| Text primary | `text-slate-900` | `#0F172A` | Values, primary text |
| Text label | `text-slate-600` | `#475569` | Labels, secondary text |
| Text caption | `text-slate-500` | `#64748B` | Helper, captions, empty states |
| **Brand primary** | `bg-[#d10a11]` / `text-[#d10a11]` | OptiBio red | Primary CTA only |
| Primary hover | `bg-[#a30a0f]` | OptiBio red dark | CTA hover |
| Status: New / Draft | `bg-blue-100 text-blue-700` | | RFQ status pills |
| Status: In Review / Formulating | `bg-yellow-100 text-yellow-700` / `bg-purple-100 text-purple-700` | | |
| Status: Quoted / Sent | `bg-green-100 text-green-700` / `bg-indigo-100 text-indigo-700` | | |
| Status: Accepted | `bg-emerald-100 text-emerald-700` | | |
| Status: Rejected | `bg-red-100 text-red-700` | | |

The OptiBio red (`#d10a11`) is the **only** brand color. Dashboard data may use neutral grays; quote totals and CTAs use red. Status pills use Tailwind's tinted-100 backgrounds with -700 text.

### Components

- **Inputs:** `border-slate-300 rounded-md text-sm px-3 py-2`. No floating labels, no shadow-only inputs.
- **Primary buttons:** `bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md px-4 py-2`. Add icon at `h-4 w-4 mr-2` if applicable.
- **Secondary buttons:** `border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md px-4 py-2 text-sm font-medium`.
- **Tables:** Use real `<table>`. Header row: `bg-slate-50 border-b border-slate-200`. Rows: `border-b border-slate-100 hover:bg-slate-50/50`. Numeric cells right-aligned and `tabular-nums`.
- **Cards (for list items):** **Avoid.** Use rows in tables. Cards waste vertical space. Reserve cards for detail-page summaries (e.g., RFQ detail header).
- **Forms:** `max-w-3xl` for single-column. 2-column grids use `grid grid-cols-2 gap-4`.
- **Status pills:** `inline-block px-2.5 py-1 text-xs font-medium rounded-full` + status color.

## Module Structure (Sidebar)

The sidebar is **immutable**. These are the Phase-1 modules:

1. **Dashboard** — `/` — Command center: new RFQs count, active quotes, pipeline value, recent activity.
2. **Pipeline** — `/pipeline` — Sales pipeline visualization (Lead → Opportunity → Quote → Closed).
3. **Intake** — `/intake` — RFQ list. `/intake/new` is the Magic Box.
4. **The Lab** — `/formulations` — Formulation queue (Draft → In Progress → Done).
5. **Quotes** — `/quotes` — Quote queue with version history. `/quotes/new`, `/quotes/[id]`.
6. **Customers** — `/customers` — CRM customer list.
7. **Suppliers** — `/suppliers` — Supplier database.
8. **Inventory** — `/ingredients` — Master ingredient database (search, filter, edit).
9. **Packaging** — `/packaging` — Packaging materials.
10. **Settings** — `/settings` — Cost centers, tier margins, user prefs.

The current sidebar (`src/components/layout/Sidebar.tsx`) covers most of these. Confirm + complete during Step 4 of the plan.

**Sidebar must always be visible on every protected route.** No full-page takeovers. No modals that hide it. Wrap every page in `<DashboardShell>`.

## Process Check (before every UI change)

1. "Does this hide the Sidebar?" → If yes, **stop**.
2. "Does this use `gap-8` or larger padding?" → If yes, **stop and tighten**.
3. "Is this mapped to one of the 10 sidebar modules?" → If no, **stop and clarify placement**.
4. "Does this use any color other than neutral grays + OptiBio red + status pill colors?" → If yes, **stop and justify**.
5. "Are numeric/data cells using `tabular-nums` and right-aligned?" → If no, **fix**.

## When to run `/design-shotgun`

Before any non-trivial new screen. The shotgun generates 3+ HTML variants in a sandbox; pick one before writing React. We've already paid the price for skipping this step (13 prior repos with inconsistent UIs).

Specifically run it before building:
- The Magic Box / Single-Page Workbench
- The Costing Sheet / Quote Workspace
- The Pipeline kanban
- The PDF quote layout

## Reference

- `supplement-quote-app26/PROJECT_RULES.md` — original "high-density B2B" rule set.
- gstack `DESIGN.md` — for typography scale conventions (we use a tighter scale for ERP density).
