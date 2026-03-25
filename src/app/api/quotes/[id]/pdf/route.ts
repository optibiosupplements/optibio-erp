import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quotes, quoteTiers, quoteLineItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const quote = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    if (quote.length === 0) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    const q = quote[0];
    const meta = safeJSON(q.notes);

    const tiers = await db
      .select()
      .from(quoteTiers)
      .where(eq(quoteTiers.quoteId, q.id));

    // Build HTML-based PDF (rendered server-side, returned as downloadable HTML)
    const html = buildQuoteHTML(q, meta, tiers);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${q.quoteNumber}.html"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildQuoteHTML(q: any, meta: any, tiers: any[]) {
  const date = new Date(q.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const validDate = q.validUntil
    ? new Date(q.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "30 days from issue";

  const tierRows = tiers
    .sort((a, b) => a.tierQuantity - b.tierQuantity)
    .map((t) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">${Number(t.tierQuantity).toLocaleString()}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(t.rawMaterialCost).toFixed(2)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(t.manufacturingCost).toFixed(2)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(t.packagingCost).toFixed(2)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(t.overheadCost).toFixed(2)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">$${Number(t.cogsPerUnit).toFixed(2)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">${Number(t.marginPct).toFixed(0)}%</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#d10a11;">$${Number(t.pricePerUnit).toFixed(2)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">$${Number(t.totalBatchPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quote ${q.quoteNumber}</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111827; margin: 0; padding: 40px; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #d10a11; }
    .company h1 { margin: 0; font-size: 24px; color: #111; } .company h1 span { color: #d10a11; }
    .company p { margin: 2px 0; color: #6b7280; font-size: 12px; }
    .quote-info { text-align: right; }
    .quote-info .number { font-size: 20px; font-weight: 700; color: #d10a11; }
    .quote-info p { margin: 2px 0; color: #6b7280; font-size: 12px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; font-weight: 700; color: #374151; margin: 0 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 20px; }
    .detail-item label { display: block; font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-item span { font-size: 13px; font-weight: 600; color: #111827; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { background: #f9fafb; padding: 10px 16px; text-align: left; font-weight: 600; color: #4b5563; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
    .terms { margin-top: 32px; padding: 16px; background: #f9fafb; border-radius: 8px; font-size: 11px; color: #6b7280; }
    .terms h3 { margin: 0 0 8px 0; font-size: 12px; color: #374151; }
    .terms ul { margin: 4px 0; padding-left: 16px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1><span>Opti</span>bio Supplements</h1>
      <p>131 Heartland Blvd, Edgewood, NY 11717</p>
      <p>(631) 939-2626 | quotes@optibiosupplements.com</p>
    </div>
    <div class="quote-info">
      <div class="number">${q.quoteNumber}</div>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Valid Until:</strong> ${validDate}</p>
      <p><strong>Status:</strong> ${q.status}</p>
    </div>
  </div>

  <div class="section">
    <h2>Product Specification</h2>
    <div class="detail-grid">
      <div class="detail-item"><label>Product</label><span>${meta.productName || "—"}</span></div>
      <div class="detail-item"><label>Customer</label><span>${meta.customerName || "—"}</span></div>
      <div class="detail-item"><label>Format</label><span>${meta.dosageForm || "—"}</span></div>
      <div class="detail-item"><label>Container</label><span>${meta.containerCount || "—"} ${meta.dosageForm || "units"} / bottle</span></div>
      <div class="detail-item"><label>Serving Size</label><span>${meta.servingSize || "1"} ${meta.dosageForm || "unit"}(s)</span></div>
      <div class="detail-item"><label>Total Fill</label><span>${meta.totalFillMg ? Number(meta.totalFillMg).toFixed(1) + " mg" : "—"}</span></div>
      <div class="detail-item"><label>Ingredients</label><span>${meta.ingredientCount || "—"} ingredients</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Tiered Pricing</h2>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;">Quantity</th>
          <th style="text-align:right;">Raw Mat.</th>
          <th style="text-align:right;">Mfg.</th>
          <th style="text-align:right;">Pkg.</th>
          <th style="text-align:right;">Overhead</th>
          <th style="text-align:right;">COGS/Unit</th>
          <th style="text-align:center;">Margin</th>
          <th style="text-align:right;">Price/Unit</th>
          <th style="text-align:right;">Batch Total</th>
        </tr>
      </thead>
      <tbody>
        ${tierRows}
      </tbody>
    </table>
  </div>

  <div class="terms">
    <h3>Terms & Conditions</h3>
    <ul>
      <li>Pricing valid for ${validDate}.</li>
      <li>Lead time: 8–12 weeks after batch sheet approval.</li>
      <li>Payment terms: 50% deposit, 50% upon shipment.</li>
      <li>Pricing subject to change based on raw material market fluctuations.</li>
      <li>Minimum order quantities apply as listed above.</li>
      <li>All products manufactured in a cGMP-certified facility.</li>
    </ul>
  </div>

  <div class="footer">
    <p>Optibio Supplements | 131 Heartland Blvd, Edgewood, NY 11717 | (631) 939-2626</p>
    <p>This quote is confidential and intended solely for the named recipient.</p>
  </div>
</body>
</html>`;
}

function safeJSON(str: string | null): any {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return {}; }
}
