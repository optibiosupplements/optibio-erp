/**
 * Shared PDF branding — header, footer, palette, fonts.
 * All customer-facing PDFs go through this module so the look stays consistent.
 */

import PDFDocument from "pdfkit";
import { MANUFACTURER } from "@/domains/coa/standards";

export const PDF_COLORS = {
  red: "#d10a11",
  redDark: "#a30a0f",
  text: "#0F172A",
  muted: "#64748B",
  border: "#CBD5E1",
  bg: "#F8FAFC",
} as const;

export const PDF_FONTS = {
  body: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
} as const;

export const PAGE = {
  width: 612,        // US Letter @ 72 DPI
  height: 792,
  margin: 36,        // 0.5"
  contentWidth: 612 - 72,
} as const;

export type Doc = InstanceType<typeof PDFDocument>;

/**
 * Render the top band: brand name on left, document title on right,
 * accent rule below.
 */
export function header(doc: Doc, title: string, subtitle?: string) {
  const x = PAGE.margin;
  const y = PAGE.margin;

  doc.fillColor(PDF_COLORS.red).font(PDF_FONTS.bold).fontSize(18);
  doc.text("OptiBio", x, y, { continued: true });
  doc.fillColor(PDF_COLORS.text).text(" Supplements", { continued: false });

  doc.font(PDF_FONTS.body).fontSize(8).fillColor(PDF_COLORS.muted);
  doc.text(MANUFACTURER.name, x, doc.y, { lineBreak: false });
  doc.text(MANUFACTURER.address, x, doc.y + 10, { lineBreak: false });
  doc.text(`${MANUFACTURER.phone} · ${MANUFACTURER.website}`, x, doc.y + 10, { lineBreak: false });

  // Right side: title block
  doc.fontSize(20).font(PDF_FONTS.bold).fillColor(PDF_COLORS.text);
  doc.text(title, PAGE.width / 2, y, { width: PAGE.width / 2 - PAGE.margin, align: "right" });
  if (subtitle) {
    doc.fontSize(9).font(PDF_FONTS.body).fillColor(PDF_COLORS.muted);
    doc.text(subtitle, PAGE.width / 2, y + 24, { width: PAGE.width / 2 - PAGE.margin, align: "right" });
  }

  // Accent rule
  const ruleY = y + 60;
  doc.strokeColor(PDF_COLORS.red).lineWidth(2);
  doc.moveTo(x, ruleY).lineTo(PAGE.width - PAGE.margin, ruleY).stroke();

  // Reset for content
  doc.y = ruleY + 14;
  doc.fillColor(PDF_COLORS.text).font(PDF_FONTS.body).fontSize(11);
}

/**
 * Render a fixed footer at the bottom of the current page.
 * Document number on the left, page X of Y on the right.
 */
export function footer(doc: Doc, refId: string, pageNum: number, totalPages: number) {
  const y = PAGE.height - PAGE.margin - 14;
  doc.strokeColor(PDF_COLORS.border).lineWidth(0.5);
  doc.moveTo(PAGE.margin, y - 6).lineTo(PAGE.width - PAGE.margin, y - 6).stroke();

  doc.font(PDF_FONTS.body).fontSize(8).fillColor(PDF_COLORS.muted);
  doc.text(refId, PAGE.margin, y, { lineBreak: false });
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    PAGE.width / 2,
    y,
    { width: PAGE.width / 2 - PAGE.margin, align: "right" },
  );
}

/**
 * Render a "key/value" two-column block. Used for product identification,
 * customer info, etc.
 */
export function infoGrid(doc: Doc, rows: Array<[string, string]>, opts?: { x?: number; columnGap?: number }) {
  const x = opts?.x ?? PAGE.margin;
  const colGap = opts?.columnGap ?? 12;
  const colWidth = (PAGE.contentWidth - colGap) / 2;
  let y = doc.y;

  for (let i = 0; i < rows.length; i += 2) {
    const [k1, v1] = rows[i];
    const [k2, v2] = rows[i + 1] ?? ["", ""];

    doc.font(PDF_FONTS.bold).fontSize(8).fillColor(PDF_COLORS.muted);
    doc.text(k1.toUpperCase(), x, y, { width: colWidth });
    if (k2) doc.text(k2.toUpperCase(), x + colWidth + colGap, y, { width: colWidth });

    doc.font(PDF_FONTS.body).fontSize(11).fillColor(PDF_COLORS.text);
    doc.text(v1 || "—", x, y + 11, { width: colWidth });
    if (k2) doc.text(v2 || "—", x + colWidth + colGap, y + 11, { width: colWidth });

    y += 30;
  }
  doc.y = y;
}

/**
 * Render a section header strip.
 */
export function sectionTitle(doc: Doc, title: string) {
  doc.moveDown(0.5);
  doc.font(PDF_FONTS.bold).fontSize(10).fillColor(PDF_COLORS.text);
  doc.text(title.toUpperCase());
  doc.moveDown(0.3);

  // Thin underline
  const y = doc.y;
  doc.strokeColor(PDF_COLORS.red).lineWidth(0.75);
  doc.moveTo(PAGE.margin, y).lineTo(PAGE.margin + 60, y).stroke();
  doc.moveDown(0.5);

  doc.font(PDF_FONTS.body).fontSize(11).fillColor(PDF_COLORS.text);
}

/**
 * Render a simple table. Columns are arrays of {header, width, align?}.
 * Rows are arrays of strings/numbers in the same order.
 *
 * Returns the y-position after the table.
 */
export interface Column {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export function renderTable(
  doc: Doc,
  cols: Column[],
  rows: (string | number)[][],
  opts?: { headerBg?: string; rowHeight?: number; emphasizeFirstCol?: boolean },
) {
  const x = PAGE.margin;
  const headerBg = opts?.headerBg ?? PDF_COLORS.bg;
  const rowH = opts?.rowHeight ?? 18;
  const emphFirst = opts?.emphasizeFirstCol ?? false;

  // Header row
  let y = doc.y;
  doc.rect(x, y, PAGE.contentWidth, rowH).fillAndStroke(headerBg, PDF_COLORS.border);
  doc.fillColor(PDF_COLORS.text).font(PDF_FONTS.bold).fontSize(9);

  let cx = x;
  for (const col of cols) {
    doc.text(col.header, cx + 4, y + 5, { width: col.width - 8, align: col.align ?? "left", lineBreak: false });
    cx += col.width;
  }

  // Body rows
  y += rowH;
  doc.font(PDF_FONTS.body).fontSize(10).fillColor(PDF_COLORS.text);
  for (const row of rows) {
    doc.rect(x, y, PAGE.contentWidth, rowH).fillAndStroke("#FFFFFF", PDF_COLORS.border);
    cx = x;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const val = String(row[i] ?? "");
      const font = i === 0 && emphFirst ? PDF_FONTS.bold : PDF_FONTS.body;
      doc.font(font);
      doc.text(val, cx + 4, y + 5, { width: col.width - 8, align: col.align ?? "left", lineBreak: false });
      cx += col.width;
    }
    y += rowH;
  }

  doc.y = y + 4;
  return y;
}
