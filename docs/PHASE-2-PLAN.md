# Phase 2 — Quote → Order → Batch → COA → Ship

> Status: design + schema landing. Routes/UI iterative.
> Owner: Panna. AI agent: Claude Opus 4.7.
> Reviewed by: CEO / Eng / Operations / QA / Customer SME panels.

## Goal

Close the loop from accepted quote to shipped finished goods with full GMP traceability. Phase 1 ships a quote. Phase 2 books the revenue and issues a release-ready COA.

## SME panel summary

| Role | Verdict |
|---|---|
| **CEO** | Phase 1 closes the first sale. Phase 2 closes the loop. Without it, every accepted quote falls back into Excel. Build it. |
| **Eng Manager** | Same Drizzle schema, no rewrite. Add 10 new tables. UUID PKs, FK cascades, immutable lot/COA records. Generate proper migrations before prod cutover. |
| **Operations** | Need lot numbers, production runs, raw-material → finished-product traceability. Without these the ERP is a glorified Excel. |
| **QA / Regulatory** | 21 CFR 111 demands a COA per finished lot, with test results, signed off, append-only. Spec Sheet (Phase 1) is not a COA. |
| **Customer** | Need PO #, ship date, COA on demand, one-click reorder. Currently we deliver none of these. |

## What's already shipped (Phase 1)

```
RFQ (Magic Box)  →  Formulation (Lab)  →  Quote (Excel + Spec Sheet)  →  ⛔  STOPS
```

## What Phase 2 adds

```
Quote ACCEPTED
    │
    ▼
Purchase Order (PO #, customer PO, accepted_quote_id, total, status)
    │
    │ 1+ line items
    ▼
PO Line Items (formulation, quantity, unit_price, total)
    │
    │ kicks off
    ▼
Production Run (batch #, formulation_id, batch_size, status, dates)
    │
    │ consumes
    ▼
Raw Material Lots (incoming inventory: lot, supplier, ingredient, qty, supplier COA)
    │
    │ produces
    ▼
Finished Product Lot (our lot #, formulation_id, production_run_id, qty)
    │
    │ tested, results recorded
    ▼
Finished Product COA (signed, append-only, PDF + structured results)
    │
    │ released
    ▼
Shipment (carrier, tracking, ship_date, delivered_date)
    │
    ▼
Customer receives bottle + COA (matches PO, references our finished_product_lot)
```

## Schema additions (10 tables)

All new tables in `src/lib/db/schema.ts`. UUID primary keys. `created_at` + `updated_at` everywhere. FK references with cascade on parent delete (except for COAs and lot records — those are immutable history).

### 1. `purchase_orders`
The accepted version of a quote.
- `id`, `po_number` (unique, `PO-YYMM-####`)
- `customer_id` (FK)
- `accepted_quote_id` (FK to quotes, the version we're producing)
- `customer_po_number` (their internal PO ref — text, not unique)
- `tier_quantity` (which quote tier they accepted: 2K / 5K / 10K)
- `unit_price` (locked at acceptance)
- `total_value` (computed: tier × unit_price)
- `status` enum: `Pending` → `Accepted` → `In Production` → `QC Hold` → `Released` → `Shipped` → `Delivered` → `Closed`
- `accepted_at`, `target_ship_date`
- `notes`

### 2. `po_line_items`
Multi-product POs (one PO can include multiple SKUs).
- `id`, `purchase_order_id` (FK cascade)
- `formulation_id` (FK)
- `quantity` (bottles)
- `unit_price`, `line_total`
- `sort_order`

### 3. `production_runs`
The factory-floor record of a batch being made.
- `id`, `batch_number` (unique, `B-YYMM-####`)
- `formulation_id` (FK)
- `purchase_order_id` (FK — what triggered this run)
- `target_batch_size` (capsules)
- `actual_batch_size`
- `start_date`, `completion_date`
- `status` enum: `Scheduled` → `Blending` → `Encapsulating` → `Packaging` → `Complete` → `On Hold`
- `manufacturing_site` (default: `Nutra Solutions USA — 1019 Grand Blvd, Deer Park, NY`)
- `lead_qc_analyst`, `release_qa_manager`
- `notes`

### 4. `raw_material_lots`
Incoming inventory. Every kg of every ingredient we receive gets a lot.
- `id`, `lot_number` (unique, supplier-issued)
- `ingredient_id` (FK)
- `supplier_id` (FK)
- `quantity_kg`
- `received_date`, `expiry_date`
- `supplier_coa_url` (link to their COA PDF)
- `manufacturing_date_at_supplier`
- `cost_per_kg_actual` (what we actually paid this time, may differ from master pricing)
- `status` enum: `Quarantine` → `Approved` → `In Use` → `Depleted` → `Rejected`
- `notes`

### 5. `lot_movements`
In/out tracking for full GMP traceability.
- `id`, `raw_material_lot_id` (FK)
- `production_run_id` (FK, nullable for non-production movements)
- `quantity_kg` (signed: positive = in, negative = consumed)
- `movement_type` enum: `Receipt` → `Issue to Production` → `Adjustment` → `Disposal`
- `movement_date`
- `operator`
- `notes`

### 6. `finished_product_lots`
What we made and what we're shipping.
- `id`, `lot_number` (unique, `2YMM-NNN` format like the canonical `2508-231`)
- `formulation_id` (FK)
- `production_run_id` (FK)
- `quantity_units` (bottles)
- `manufacturing_date`, `expiration_date` (typically 36 months out)
- `stability_protocol` (e.g., `STAB-NS3318C-001`)
- `product_code` (e.g., `NS-3318C`)
- `status` enum: `In QC` → `Released` → `Shipped` → `Recalled`
- `notes`

### 7. `finished_product_coas`
The COA, append-only. Once signed, immutable. Revisions create new COA records that supersede the old.
- `id`, `coa_number` (unique, `COA-NS3318C-2508-231`)
- `finished_product_lot_id` (FK)
- `revision` (default 0; supersession increments)
- `superseded_by_coa_id` (FK self-reference, nullable)
- `disposition` enum: `Approved for Release` → `Quarantine` → `Reject`
- `qc_analyst`, `qc_analyst_signature_date`
- `qc_manager`, `qc_manager_signature_date`
- `qa_release`, `qa_release_signature_date`
- `lab_sample_id`
- `lab_accreditation` (default: `ISO 17025:2017`)
- `testing_lab` (default: `Nutra Solutions USA — In-House QC Lab`)
- `pdf_url` (link to generated PDF)
- `created_at` (no `updated_at` — append-only)

### 8. `coa_test_results`
Per-test results for a COA. Multiple per COA (potency lines + microbial + heavy metals + physical).
- `id`, `coa_id` (FK cascade)
- `category` enum: `Physical` | `Potency` | `Microbial` | `Heavy Metal`
- `test_name` (e.g., `Vitamin C (as Ascorbic Acid)`)
- `specification` (e.g., `90–135 mg (100–150%)`)
- `result` (e.g., `93.6 mg`)
- `pct_of_label_claim` (numeric, nullable for non-potency)
- `method` (e.g., `HPLC`, `USP <2021>`, `ICP-MS`)
- `status` enum: `Pass` | `Fail` | `OOS`
- `sort_order`

### 9. `shipments`
- `id`, `purchase_order_id` (FK)
- `finished_product_lot_id` (FK)
- `quantity_units`
- `carrier` (FedEx / UPS / DHL / Freight)
- `tracking_number`
- `ship_date`, `delivered_date` (nullable)
- `customer_signature_url`
- `status` enum: `Scheduled` → `Picked Up` → `In Transit` → `Delivered` → `Returned`

### 10. `documents`
Generic file-storage references. One row per uploaded/generated file.
- `id`, `kind` enum: `Quote PDF` | `Quote XLSX` | `Spec Sheet` | `Supplier COA` | `FP COA` | `Batch Record` | `Other`
- `url` (S3 / Vercel Blob / etc.)
- `filename`, `size_bytes`, `mime_type`
- `related_table` (e.g., `quotes`), `related_id` (UUID)
- `uploaded_by`
- `created_at`

## Implementation order

| Step | Tables | Why first | Effort |
|---|---|---|---|
| 1 | `purchase_orders`, `po_line_items` | Quote acceptance is the immediate next click | 30 min |
| 2 | `production_runs` | Batch tracking — minimum viable manufacturing | 30 min |
| 3 | `finished_product_lots`, `finished_product_coas`, `coa_test_results` | The COA generator we already promised | 60 min |
| 4 | `raw_material_lots`, `lot_movements` | Full GMP traceability — Phase 2.5 | 90 min |
| 5 | `shipments` | Customer-visible "where is my order" | 30 min |
| 6 | `documents` | Replaces ad-hoc URL columns scattered across tables | 30 min |
| 7 | UI for above | Order list, batch list, COA generator | 4–6 hrs |
| 8 | Generate-COA endpoint w/ test results | Real GMP COAs, not just spec sheets | 90 min |

Steps 1–6 are pure schema (this PR). Steps 7–8 are follow-up PRs.

## Migration safety

- All Phase 2 tables are NEW (no destructive changes to existing tables).
- `db:push` is safe — only adds tables, can't break existing routes.
- `created_at` defaults to `NOW()` so backfilling isn't needed.
- Status enums are stored as `text` (not Postgres enums) per Drizzle convention — easier to evolve.

## Future phases (not now)

- **Phase 3 — Inventory & Supplier Management**: live inventory levels, supplier scorecards, certification expirations, automatic re-order points
- **Phase 4 — Customer Portal**: customers log in, see their COAs, reorder from past formulations, track shipments
- **Phase 5 — Multi-site / Multi-currency**: when Optibio expands to a second facility or international customers
- **Phase 6 — Integrations**: QuickBooks for invoicing, ShipStation for shipping, Slack for notifications
