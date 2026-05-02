import PDFDocument from "pdfkit";
import { footer, header, infoGrid, sectionTitle, renderTable, PDF_COLORS, PDF_FONTS, PAGE } from "./branding";

export interface InvoicePdfData {
  invoiceNumber: string;
  poNumber?: string;
  customerPo?: string;
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
}

export function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: PAGE.margin, autoFirstPage: false });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.addPage({ size: "LETTER", margin: PAGE.margin });

      header(doc, "INVOICE", data.invoiceNumber);

      // Bill-to / invoice info
      infoGrid(doc, [
        ["Bill To", data.customerName],
        ["Invoice Date", data.issueDate],
        ["Customer PO", data.customerPo || data.poNumber || "—"],
        ["Due Date", data.dueDate],
        ["Customer Email", data.customerEmail || "—"],
        ["Payment Terms", data.paymentTerms],
      ]);

      if (data.customerAddress) {
        doc.font(PDF_FONTS.body).fontSize(10).fillColor(PDF_COLORS.muted);
        doc.text(data.customerAddress, { width: PAGE.contentWidth });
      }

      // Line items
      sectionTitle(doc, "Line Items");
      renderTable(
        doc,
        [
          { header: "Description", width: 260 },
          { header: "Qty", width: 80, align: "right" },
          { header: "Unit Price", width: 90, align: "right" },
          { header: "Total", width: 110, align: "right" },
        ],
        data.lineItems.map((l) => [
          l.description,
          l.quantity.toLocaleString(),
          `$${l.unitPrice.toFixed(2)}`,
          `$${l.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ]),
        { emphasizeFirstCol: true },
      );

      // Totals block — right-aligned at the bottom
      doc.moveDown(0.5);
      const totalsX = PAGE.width - PAGE.margin - 240;
      const colLabel = 130;
      const colValue = 110;

      function totalRow(label: string, value: string, opts?: { bold?: boolean; underline?: boolean }) {
        doc.font(opts?.bold ? PDF_FONTS.bold : PDF_FONTS.body).fontSize(opts?.bold ? 11 : 10);
        doc.fillColor(PDF_COLORS.text);
        doc.text(label, totalsX, doc.y, { width: colLabel, align: "right", lineBreak: false });
        doc.text(value, totalsX + colLabel, doc.y, { width: colValue, align: "right" });
        if (opts?.underline) {
          const y = doc.y + 1;
          doc.strokeColor(PDF_COLORS.border).lineWidth(0.75);
          doc.moveTo(totalsX, y).lineTo(totalsX + colLabel + colValue, y).stroke();
        }
      }

      totalRow("Subtotal:", `$${data.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      if (data.taxAmount > 0) {
        totalRow("Tax:", `$${data.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
      totalRow("Total:", `$${data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { bold: true, underline: true });

      doc.moveDown(0.3);
      if (data.amountPaid > 0) {
        totalRow("Amount Paid:", `$${data.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
      const balance = data.totalAmount - data.amountPaid;
      doc.moveDown(0.2);
      totalRow("Balance Due:", `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { bold: true });

      doc.moveDown(2);

      // Payment instructions
      sectionTitle(doc, "Payment Instructions");
      doc.font(PDF_FONTS.body).fontSize(10).fillColor(PDF_COLORS.text);
      doc.text("Please remit payment to:", { paragraphGap: 4 });
      doc.font(PDF_FONTS.bold);
      doc.text("Nutra Solutions USA");
      doc.font(PDF_FONTS.body);
      doc.text("1019 Grand Blvd");
      doc.text("Deer Park, NY 11729");
      doc.moveDown(0.3);
      doc.text("ACH preferred. Bank details available on request via accounting@nutrasolutionsusa.com.", { width: PAGE.contentWidth });

      doc.moveDown(0.5);
      doc.font(PDF_FONTS.bold).fontSize(10).fillColor(PDF_COLORS.text);
      doc.text(`Reference invoice ${data.invoiceNumber} on remittance.`);

      // Status badge if paid
      if (data.status === "Paid") {
        doc.moveDown(0.5);
        doc.fillColor("#15803D").font(PDF_FONTS.bold).fontSize(14);
        doc.text("✓ PAID", { align: "right" });
      } else if (balance > 0 && new Date(data.dueDate) < new Date()) {
        doc.moveDown(0.5);
        doc.fillColor(PDF_COLORS.red).font(PDF_FONTS.bold).fontSize(11);
        doc.text("OVERDUE — please remit immediately", { align: "right" });
      }

      footer(doc, data.invoiceNumber, 1, 1);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
