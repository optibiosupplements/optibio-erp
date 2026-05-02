import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  date,
} from "drizzle-orm/pg-core";

// ============================================================================
// SYSTEM TABLES
// ============================================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const capsuleSizes = pgTable("capsule_sizes", {
  size: text("size").primaryKey(),
  capacityMg: numeric("capacity_mg", { precision: 10, scale: 2 }).notNull(),
  costPer1000: numeric("cost_per_1000", { precision: 10, scale: 2 }).default("6.00"),
});

// ============================================================================
// CORE TABLES
// ============================================================================

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  tier: text("tier").notNull().default("Standard"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ingredients = pgTable("ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  rmId: text("rm_id").unique().notNull(),
  name: text("name").notNull(),
  scientificName: text("scientific_name"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name"),
  costPerKg: numeric("cost_per_kg", { precision: 10, scale: 2 }).notNull(),
  assayPercentage: numeric("assay_percentage", { precision: 5, scale: 2 }).default("100"),
  activeContentPct: numeric("active_content_pct", { precision: 5, scale: 2 }).notNull(),
  activeSource: text("active_source"),
  labelClaimActive: boolean("label_claim_active").notNull().default(true),
  multiComponent: boolean("multi_component").notNull().default(false),
  baseOveragePct: numeric("base_overage_pct", { precision: 5, scale: 2 }).default("10"),
  baseWastagePct: numeric("base_wastage_pct", { precision: 5, scale: 2 }).default("3"),
  overageCapsule: numeric("overage_capsule", { precision: 5, scale: 2 }),
  overageTablet: numeric("overage_tablet", { precision: 5, scale: 2 }),
  overagePowder: numeric("overage_powder", { precision: 5, scale: 2 }),
  overageStickPack: numeric("overage_stick_pack", { precision: 5, scale: 2 }),
  wastageCapsule: numeric("wastage_capsule", { precision: 5, scale: 2 }),
  wastageTablet: numeric("wastage_tablet", { precision: 5, scale: 2 }),
  wastagePowder: numeric("wastage_powder", { precision: 5, scale: 2 }),
  wastageStickPack: numeric("wastage_stick_pack", { precision: 5, scale: 2 }),
  functionDesc: text("function_desc"),
  isEstimatedPrice: boolean("is_estimated_price").notNull().default(false),
  moqKg: numeric("moq_kg", { precision: 10, scale: 2 }),
  leadTimeDays: integer("lead_time_days"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ingredientComponents = pgTable("ingredient_components", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentIngredientId: uuid("parent_ingredient_id")
    .references(() => ingredients.id, { onDelete: "cascade" })
    .notNull(),
  componentName: text("component_name").notNull(),
  componentType: text("component_type").notNull(),
  mgPerGram: numeric("mg_per_gram", { precision: 10, scale: 4 }).notNull(),
  elementalPct: numeric("elemental_pct", { precision: 5, scale: 4 }).notNull(),
  dailyValueMg: numeric("daily_value_mg", { precision: 10, scale: 2 }),
  notes: text("notes"),
});

// ============================================================================
// FORMULATION TABLES
// ============================================================================

export const formulations = pgTable("formulations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  dosageForm: text("dosage_form").notNull(),
  capsuleSize: text("capsule_size"),
  capsulesPerServing: integer("capsules_per_serving").notNull().default(1),
  servingsPerContainer: integer("servings_per_container"),
  batchSize: integer("batch_size"),
  totalFillMg: numeric("total_fill_mg", { precision: 10, scale: 2 }),
  fillPercentage: numeric("fill_percentage", { precision: 5, scale: 2 }),
  excipientComplexity: text("excipient_complexity").notNull().default("standard"),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("Draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const formulationIngredients = pgTable("formulation_ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  formulationId: uuid("formulation_id")
    .references(() => formulations.id, { onDelete: "cascade" })
    .notNull(),
  ingredientId: uuid("ingredient_id").references(() => ingredients.id),
  labelClaimMg: numeric("label_claim_mg", { precision: 10, scale: 4 }).notNull(),
  activeContentPct: numeric("active_content_pct", { precision: 5, scale: 2 }).notNull(),
  adjustedMg: numeric("adjusted_mg", { precision: 10, scale: 4 }).notNull(),
  overagePct: numeric("overage_pct", { precision: 5, scale: 2 }).notNull(),
  finalMg: numeric("final_mg", { precision: 10, scale: 4 }).notNull(),
  costPerKg: numeric("cost_per_kg", { precision: 10, scale: 2 }).notNull(),
  wastagePct: numeric("wastage_pct", { precision: 5, scale: 2 }).notNull(),
  lineCost: numeric("line_cost", { precision: 10, scale: 4 }).notNull(),
  isExcipient: boolean("is_excipient").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ============================================================================
// QUOTE & PRICING TABLES
// ============================================================================

export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteNumber: text("quote_number").unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  formulationId: uuid("formulation_id").references(() => formulations.id),
  status: text("status").notNull().default("Draft"),
  version: integer("version").notNull().default(1),
  validUntil: date("valid_until"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const quoteTiers = pgTable("quote_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id")
    .references(() => quotes.id, { onDelete: "cascade" })
    .notNull(),
  tierQuantity: integer("tier_quantity").notNull(),
  rawMaterialCost: numeric("raw_material_cost", { precision: 10, scale: 4 }).notNull(),
  manufacturingCost: numeric("manufacturing_cost", { precision: 10, scale: 4 }).notNull(),
  packagingCost: numeric("packaging_cost", { precision: 10, scale: 4 }).notNull(),
  overheadCost: numeric("overhead_cost", { precision: 10, scale: 4 }).notNull(),
  cogsPerUnit: numeric("cogs_per_unit", { precision: 10, scale: 4 }).notNull(),
  marginPct: numeric("margin_pct", { precision: 5, scale: 2 }).notNull(),
  pricePerUnit: numeric("price_per_unit", { precision: 10, scale: 4 }).notNull(),
  totalBatchPrice: numeric("total_batch_price", { precision: 12, scale: 2 }).notNull(),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteTierId: uuid("quote_tier_id")
    .references(() => quoteTiers.id, { onDelete: "cascade" })
    .notNull(),
  lineType: text("line_type").notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }),
  unitCost: numeric("unit_cost", { precision: 10, scale: 4 }),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ============================================================================
// PACKAGING TABLES
// ============================================================================

export const packagingMaterials = pgTable("packaging_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: text("material_id").unique().notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: text("size"),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  baseCost: numeric("base_cost", { precision: 10, scale: 4 }).notNull(),
  moq: integer("moq"),
  leadTimeDays: integer("lead_time_days"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const formulationPackaging = pgTable("formulation_packaging", {
  id: uuid("id").defaultRandom().primaryKey(),
  formulationId: uuid("formulation_id")
    .references(() => formulations.id, { onDelete: "cascade" })
    .notNull(),
  materialId: uuid("material_id")
    .references(() => packagingMaterials.id)
    .notNull(),
  quantityPerUnit: numeric("quantity_per_unit", { precision: 10, scale: 4 }).default("1"),
  notes: text("notes"),
});

// ============================================================================
// RFQ / INTAKE TABLES
// ============================================================================

export const rfqs = pgTable("rfqs", {
  id: uuid("id").defaultRandom().primaryKey(),
  rfqNumber: text("rfq_number").unique().notNull(),
  status: text("status").notNull().default("New"),
  priority: text("priority").notNull().default("Normal"),
  source: text("source").notNull().default("Email"),

  // Section 1: Customer
  customerId: uuid("customer_id").references(() => customers.id),
  customerCompany: text("customer_company"),
  customerContact: text("customer_contact"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),

  // Section 2: Product Specification
  productName: text("product_name"),
  dosageForm: text("dosage_form"),
  servingSize: integer("serving_size"),
  servingSizeUnit: text("serving_size_unit"),
  servingsPerContainer: integer("servings_per_container"),
  countPerBottle: integer("count_per_bottle"),
  flavor: text("flavor"),
  targetRetailPrice: numeric("target_retail_price", { precision: 10, scale: 2 }),

  // Section 3: Formula (JSON — extracted ingredients)
  formulaJson: text("formula_json"),
  otherIngredients: text("other_ingredients"),
  specialRequirements: text("special_requirements"),

  // Section 4: Packaging
  bulkOrPackaged: text("bulk_or_packaged").default("Packaged"),
  primaryPackaging: text("primary_packaging"),
  capsuleType: text("capsule_type"),
  capsuleSize: text("capsule_size"),
  secondaryPackaging: text("secondary_packaging"),
  labelStatus: text("label_status"),

  // Section 5: Regulatory
  certifications: text("certifications"),
  targetMarkets: text("target_markets"),
  allergenStatement: text("allergen_statement"),
  claims: text("claims"),

  // Section 6: Manufacturing
  moq: integer("moq"),
  targetTimeline: text("target_timeline"),
  coPackerPreference: text("co_packer_preference"),

  // Section 7: Attachments & Notes
  attachmentUrls: text("attachment_urls"),
  internalNotes: text("internal_notes"),
  customerNotes: text("customer_notes"),

  // Linked records
  formulationId: uuid("formulation_id").references(() => formulations.id),
  quoteId: uuid("quote_id").references(() => quotes.id),

  // Meta
  version: integer("version").notNull().default(1),
  deadline: date("deadline"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// MANUFACTURING TABLES
// ============================================================================

export const manufacturingCostCenters = pgTable("manufacturing_cost_centers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  costType: text("cost_type").notNull(),
  productFormat: text("product_format"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 4 }),
  costPerHour: numeric("cost_per_hour", { precision: 10, scale: 2 }),
  costPerBatch: numeric("cost_per_batch", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
});

// ============================================================================
// CRM TABLES
// ============================================================================

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id),
  title: text("title").notNull(),
  source: text("source"),
  nepqStage: text("nepq_stage").notNull().default("initial_contact"),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id),
  leadId: uuid("lead_id").references(() => leads.id),
  quoteId: uuid("quote_id").references(() => quotes.id),
  title: text("title").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }),
  stage: text("stage").notNull().default("Lead"),
  probability: integer("probability").default(0),
  expectedCloseDate: date("expected_close_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id),
  leadId: uuid("lead_id").references(() => leads.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// PHASE 2 — ORDERS, BATCHES, COAs, SHIPPING, DOCUMENTS
// (See docs/PHASE-2-PLAN.md)
// ============================================================================

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  poNumber: text("po_number").unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  acceptedQuoteId: uuid("accepted_quote_id").references(() => quotes.id),
  customerPoNumber: text("customer_po_number"),
  tierQuantity: integer("tier_quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("Pending"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  targetShipDate: date("target_ship_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const poLineItems = pgTable("po_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .references(() => purchaseOrders.id, { onDelete: "cascade" })
    .notNull(),
  formulationId: uuid("formulation_id").references(() => formulations.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productionRuns = pgTable("production_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchNumber: text("batch_number").unique().notNull(),
  formulationId: uuid("formulation_id").references(() => formulations.id),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id),
  targetBatchSize: integer("target_batch_size").notNull(),
  actualBatchSize: integer("actual_batch_size"),
  startDate: date("start_date"),
  completionDate: date("completion_date"),
  status: text("status").notNull().default("Scheduled"),
  manufacturingSite: text("manufacturing_site").default("Nutra Solutions USA — 1019 Grand Blvd, Deer Park, NY"),
  leadQcAnalyst: text("lead_qc_analyst"),
  releaseQaManager: text("release_qa_manager"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rawMaterialLots = pgTable("raw_material_lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  lotNumber: text("lot_number").notNull(),
  ingredientId: uuid("ingredient_id")
    .references(() => ingredients.id)
    .notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  quantityKg: numeric("quantity_kg", { precision: 12, scale: 4 }).notNull(),
  receivedDate: date("received_date").notNull(),
  expiryDate: date("expiry_date"),
  manufacturingDateAtSupplier: date("manufacturing_date_at_supplier"),
  supplierCoaUrl: text("supplier_coa_url"),
  costPerKgActual: numeric("cost_per_kg_actual", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("Quarantine"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lotMovements = pgTable("lot_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  rawMaterialLotId: uuid("raw_material_lot_id")
    .references(() => rawMaterialLots.id)
    .notNull(),
  productionRunId: uuid("production_run_id").references(() => productionRuns.id),
  quantityKg: numeric("quantity_kg", { precision: 12, scale: 4 }).notNull(),
  movementType: text("movement_type").notNull(),
  movementDate: timestamp("movement_date", { withTimezone: true }).defaultNow().notNull(),
  operator: text("operator"),
  notes: text("notes"),
});

export const finishedProductLots = pgTable("finished_product_lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  lotNumber: text("lot_number").unique().notNull(),
  formulationId: uuid("formulation_id")
    .references(() => formulations.id)
    .notNull(),
  productionRunId: uuid("production_run_id").references(() => productionRuns.id),
  quantityUnits: integer("quantity_units").notNull(),
  manufacturingDate: date("manufacturing_date").notNull(),
  expirationDate: date("expiration_date"),
  stabilityProtocol: text("stability_protocol"),
  productCode: text("product_code"),
  status: text("status").notNull().default("In QC"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const finishedProductCoas = pgTable("finished_product_coas", {
  id: uuid("id").defaultRandom().primaryKey(),
  coaNumber: text("coa_number").unique().notNull(),
  finishedProductLotId: uuid("finished_product_lot_id")
    .references(() => finishedProductLots.id)
    .notNull(),
  revision: integer("revision").notNull().default(0),
  supersededByCoaId: uuid("superseded_by_coa_id"),
  disposition: text("disposition").notNull().default("Approved for Release"),
  qcAnalyst: text("qc_analyst"),
  qcAnalystSignatureDate: date("qc_analyst_signature_date"),
  qcManager: text("qc_manager"),
  qcManagerSignatureDate: date("qc_manager_signature_date"),
  qaRelease: text("qa_release"),
  qaReleaseSignatureDate: date("qa_release_signature_date"),
  labSampleId: text("lab_sample_id"),
  labAccreditation: text("lab_accreditation").default("ISO 17025:2017"),
  testingLab: text("testing_lab").default("Nutra Solutions USA — In-House QC Lab"),
  pdfUrl: text("pdf_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const coaTestResults = pgTable("coa_test_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  coaId: uuid("coa_id")
    .references(() => finishedProductCoas.id, { onDelete: "cascade" })
    .notNull(),
  category: text("category").notNull(),
  testName: text("test_name").notNull(),
  specification: text("specification").notNull(),
  result: text("result").notNull(),
  pctOfLabelClaim: numeric("pct_of_label_claim", { precision: 6, scale: 2 }),
  method: text("method").notNull(),
  status: text("status").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .references(() => purchaseOrders.id)
    .notNull(),
  finishedProductLotId: uuid("finished_product_lot_id").references(() => finishedProductLots.id),
  quantityUnits: integer("quantity_units").notNull(),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  shipDate: date("ship_date"),
  deliveredDate: date("delivered_date"),
  customerSignatureUrl: text("customer_signature_url"),
  status: text("status").notNull().default("Scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),
  url: text("url").notNull(),
  filename: text("filename"),
  sizeBytes: integer("size_bytes"),
  mimeType: text("mime_type"),
  relatedTable: text("related_table"),
  relatedId: uuid("related_id"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// PHASE 3 — ACCOUNTING (invoices, payments, tasks)
// ============================================================================

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceNumber: text("invoice_number").unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("Draft"),
  paymentTerms: text("payment_terms").default("Net 30"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentNumber: text("payment_number").unique().notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  customerId: uuid("customer_id").references(() => customers.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("Todo"),
  priority: text("priority").notNull().default("Normal"),
  assignee: text("assignee"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  relatedTable: text("related_table"),
  relatedId: uuid("related_id"),
  customerId: uuid("customer_id").references(() => customers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
