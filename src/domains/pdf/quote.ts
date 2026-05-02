import PDFDocument from "pdfkit";
import { footer, header, infoGrid, sectionTitle, renderTable, PDF_COLORS, PDF_FONTS, PAGE } from "./branding";

export interface QuotePdfData {
  quoteNumber: string;
  productName: string;
  customerName: string;
  customerCompany?: string;
  customerPo?: string;
  dosageForm: string;
  capsuleSize: string | null;
  capsulesPerServing: number;
  servingsPerContainer: string | number;
  validUntil: string;
  issuedDate: string;
  hasEstimatedPricing: boolean;
  tiers: Array<{
    qty: number;
    pricePerUnit: number;
    totalBatch: number;
    marginPct: number;
  }>;
  ingredients: Array<{
    name: string;
    labelClaim: string;
    notes?: string;
  }>;
}

export function buildQuotePdf(data: QuotePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: PAGE.margin, autoFirstPage: false });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.addPage({ size: "LETTER", margin: PAGE.margin });

      // Header
      header(doc, "QUOTE", data.quoteNumber);

      // Product info grid
      infoGrid(doc, [
        ["Customer", data.customerCompany || data.customerName],
        ["Customer PO", data.customerPo || "—"],
        ["Quote Date", data.issuedDate],
        ["Valid Until", data.validUntil],
        ["Product", data.productName],
        ["Form", data.dosageForm + (data.capsuleSize ? ` · Size ${data.capsuleSize}` : "")],
        ["Serving", `${data.capsulesPerServing} ${data.dosageForm}`],
        ["Servings / Bottle", String(data.servingsPerContainer)],
      ]);

      // Formulation
      if (data.ingredients.length > 0) {
        sectionTitle(doc, "Formula (Per Serving)");
        renderTable(
          doc,
          [
            { header: "Ingredient", width: 320 },
            { header: "Label Claim", width: 110, align: "right" },
            { header: "Notes", width: 110 },
          ],
          data.ingredients.map((i) => [i.name, i.labelClaim, i.notes ?? ""]),
          { emphasizeFirstCol: true },
        );
      }

      // Tiered pricing
      sectionTitle(doc, "Tiered Pricing");
      renderTable(
        doc,
        [
          { header: "Volume Tier", width: 130 },
          { header: "Margin %", width: 90, align: "right" },
          { header: "Price / Unit", width: 130, align: "right" },
          { header: "Batch Total", width: 190, align: "right" },
        ],
        data.tiers.map((t) => [
          `${t.qty.toLocaleString()} units`,
          `${t.marginPct.toFixed(0)}%`,
          `$${t.pricePerUnit.toFixed(2)}`,
          `$${t.totalBatch.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        ]),
      );

      if (data.hasEstimatedPricing) {
        doc.moveDown(0.5);
        doc.font(PDF_FONTS.oblique).fontSize(9).fillColor(PDF_COLORS.muted);
        doc.text(
          "Pricing includes one or more ingredients flagged as 'Estimated' in our database. Final pricing subject to confirmation when supplier sourcing is locked.",
          { width: PAGE.contentWidth },
        );
      }

      // Scope / inclusions / exclusions
      sectionTitle(doc, "Scope of Pricing");
      doc.font(PDF_FONTS.body).fontSize(10).fillColor(PDF_COLORS.text);
      const included = [
        "Raw materials (active ingredients + standard excipients)",
        `${data.dosageForm === "Capsule" ? "Vegetarian capsules" : data.dosageForm === "Tablet" ? "Tablet compression" : "Powder packaging"}`,
        "Encapsulation / packaging labor + QA in-process checks",
        "Bottle, cap, induction seal, desiccant or cotton",
        "Finished goods packaging labor",
        "Standard batch testing (allowance amortized into unit price)",
      ];
      for (const line of included) {
        doc.text(`• ${line}`, { indent: 12, paragraphGap: 2 });
      }

      doc.moveDown(0.4);
      doc.font(PDF_FONTS.bold).fontSize(10);
      doc.text("Not included:");
      doc.font(PDF_FONTS.body).fontSize(10);
      const excluded = [
        "Custom packaging beyond standard PET bottle (additional charge)",
        "Branded label printing (label artwork to be supplied by customer)",
        "Shipping and freight (charged at cost)",
        "Customer-specified third-party COA testing (additional charge)",
      ];
      for (const line of excluded) {
        doc.text(`• ${line}`, { indent: 12, paragraphGap: 2 });
      }

      // Terms / disclaimer
      sectionTitle(doc, "Terms");
      doc.font(PDF_FONTS.body).fontSize(9).fillColor(PDF_COLORS.muted);
      doc.text(
        "This document is a price quote. Final product specifications are subject to formulation review and bench testing. Label claims are pending COA per 21 CFR 101.9(g). Lead time: 8–12 weeks after batch sheet approval. Pricing valid for 30 days from quote date.",
        { width: PAGE.contentWidth, lineGap: 1 },
      );

      // Footer
      footer(doc, data.quoteNumber, 1, 1);

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
