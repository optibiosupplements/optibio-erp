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
