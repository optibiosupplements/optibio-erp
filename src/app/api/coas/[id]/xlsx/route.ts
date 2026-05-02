/**
 * GET /api/coas/[id]/xlsx
 *
 * Real release-ready COA matching the canonical NS-3318C layout:
 *
 *   Sheet 1 — COA   (single sheet, customer-facing release document)
 *
 *     PRODUCT IDENTIFICATION  (lot, code, mfg/exp dates, batch size, serving size)
 *     PHYSICAL SPECIFICATIONS (test / spec / result / method / status)
 *     POTENCY ANALYSIS        (label claim / spec range / result / %LC / method / status)
 *     CONTAMINANT TESTING     (microbial + heavy metals with results)
 *     LABORATORY INFORMATION  (testing lab, accreditation, sample id)
 *     BATCH DISPOSITION       (Approved for Release / Quarantine / Reject)
 *     APPROVAL SIGNATURES     (QC analyst, QC manager, QA release)
 *     DISCLAIMER + COMPLIANCE FOOTER
 */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import {
  finishedProductCoas,
  coaTestResults,
  finishedProductLots,
  formulations,
  productionRuns,
  purchaseOrders,
  customers,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { MANUFACTURER, COA_DISCLAIMER } from "@/domains/coa/standards";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [coa] = await db.select().from(finishedProductCoas).where(eq(finishedProductCoas.id, id)).limit(1);
    if (!coa) return NextResponse.json({ error: "COA not found" }, { status: 404 });

    const [lot] = await db.select().from(finishedProductLots).where(eq(finishedProductLots.id, coa.finishedProductLotId)).limit(1);
    const [formulation] = lot ? await db.select().from(formulations).where(eq(formulations.id, lot.formulationId)).limit(1) : [null];
    const [run] = lot?.productionRunId
      ? await db.select().from(productionRuns).where(eq(productionRuns.id, lot.productionRunId)).limit(1)
      : [null];
    const [po] = run?.purchaseOrderId
      ? await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, run.purchaseOrderId)).limit(1)
      : [null];
    const [customer] = po?.customerId
      ? await db.select().from(customers).where(eq(customers.id, po.customerId)).limit(1)
      : [null];

    const tests = await db
      .select()
      .from(coaTestResults)
      .where(eq(coaTestResults.coaId, id))
      .orderBy(asc(coaTestResults.sortOrder));

    const physical = tests.filter((t) => t.category === "Physical");
    const potency = tests.filter((t) => t.category === "Potency");
    const microbial = tests.filter((t) => t.category === "Microbial");
    const heavyMetals = tests.filter((t) => t.category === "Heavy Metal");

    const wb = XLSX.utils.book_new();
    const rows: (string | number | null)[][] = [];

    // Header
    rows.push(["CERTIFICATE OF ANALYSIS"]);
    rows.push([`${MANUFACTURER.name} | Finished Product Release Documentation | 21 CFR Part 111 Compliant`]);
    rows.push([]);

    // Product Identification
    rows.push(["PRODUCT IDENTIFICATION"]);
    rows.push([
      "Product Name:", formulation?.name ?? "—",
      "", "Manufacturing Date:", lot?.manufacturingDate ?? "—",
    ]);
    rows.push([
      "Product Code:", lot?.productCode ?? "—",
      "", "Expiration Date:", lot?.expirationDate ?? "—",
    ]);
    rows.push([
      "Lot/Batch Number:", lot?.lotNumber ?? "—",
      "", "Stability Protocol:", lot?.stabilityProtocol ?? "—",
    ]);
    rows.push([
      "Batch Size:", run?.actualBatchSize ?? run?.targetBatchSize ?? "—",
      "", "Product Description:", `Size #${formulation?.capsuleSize ?? "00"} ${formulation?.dosageForm?.toLowerCase() ?? "capsule"}`,
    ]);
    rows.push([
      "Customer PO #:", po?.customerPoNumber ?? po?.poNumber ?? "—",
      "", "Serving Size:", `${formulation?.capsulesPerServing ?? 1} ${formulation?.dosageForm ?? "Capsule"}`,
    ]);
    rows.push([
      "Customer:", customer?.companyName ?? "—",
      "", "COA #:", coa.coaNumber,
    ]);
    rows.push([]);

    // Physical Specifications
    rows.push(["PHYSICAL SPECIFICATIONS"]);
    rows.push(["Test", "Specification", "Result", "Method", "Status"]);
    for (const t of physical) {
      rows.push([t.testName, t.specification, t.result, t.method, statusBadge(t.status)]);
    }
    rows.push([]);

    // Potency Analysis
    rows.push([`POTENCY ANALYSIS — Per Serving — 21 CFR 101.9(g)(4)(i) Compliant`]);
    rows.push(["Dietary Ingredient", "Specification Range", "Result", "% of LC", "Method", "Status"]);
    for (const t of potency) {
      rows.push([
        t.testName,
        t.specification,
        t.result,
        t.pctOfLabelClaim ? `${parseFloat(t.pctOfLabelClaim).toFixed(1)}%` : "",
        t.method,
        statusBadge(t.status),
      ]);
    }
    rows.push([]);

    // Microbial
    rows.push(["CONTAMINANT TESTING — Microbial Analysis"]);
    rows.push(["Test", "Specification", "Result", "Method", "Status"]);
    for (const t of microbial) {
      rows.push([t.testName, t.specification, t.result, t.method, statusBadge(t.status)]);
    }
    rows.push([]);

    // Heavy Metals
    rows.push(["CONTAMINANT TESTING — Heavy Metal Analysis (Per Daily Dose)"]);
    rows.push(["Metal", "Specification", "Result", "Method", "Status"]);
    for (const t of heavyMetals) {
      rows.push([t.testName, t.specification, t.result, t.method, statusBadge(t.status)]);
    }
    rows.push([]);

    // Lab Info
    rows.push(["LABORATORY INFORMATION & DATA TRACEABILITY"]);
    rows.push(["Testing Laboratory:", coa.testingLab ?? MANUFACTURER.qcLab]);
    rows.push(["Lab Accreditation:", coa.labAccreditation ?? MANUFACTURER.labAccreditation]);
    rows.push(["Lab Sample ID:", coa.labSampleId ?? "—"]);
    rows.push([]);

    // Disposition
    rows.push(["BATCH DISPOSITION"]);
    rows.push(["Disposition:", coa.disposition]);
    const allPass = tests.every((t) => t.status === "Pass");
    rows.push(["Overall Result:", allPass ? "✓ PASS — All Specifications Met" : "FAILED ON ONE OR MORE TESTS — REVIEW REQUIRED"]);
    rows.push([]);

    // Signatures
    rows.push(["APPROVAL SIGNATURES"]);
    rows.push(["Role", "Printed Name", "Signature", "Date"]);
    rows.push(["QC Analyst", coa.qcAnalyst ?? "", "", coa.qcAnalystSignatureDate ?? ""]);
    rows.push(["QC Manager / Reviewer", coa.qcManager ?? "", "", coa.qcManagerSignatureDate ?? ""]);
    rows.push(["QA Release Authorization", coa.qaRelease ?? "", "", coa.qaReleaseSignatureDate ?? ""]);
    rows.push([]);

    // Disclaimer + footer
    rows.push(["DISCLAIMER"]);
    rows.push([COA_DISCLAIMER]);
    rows.push([]);
    rows.push(["COMPLIANCE"]);
    rows.push([MANUFACTURER.certifications.join(" | ")]);
    rows.push([]);
    rows.push([`${MANUFACTURER.address} | Ph: ${MANUFACTURER.phone} | ${MANUFACTURER.website}`]);
    rows.push([`Document Number: ${coa.coaNumber} | Revision: Rev. ${coa.revision} | Effective Date: ${coa.qaReleaseSignatureDate ?? new Date().toISOString().slice(0, 10)}`]);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 36 }, { wch: 30 }, { wch: 22 }, { wch: 24 }, { wch: 14 }];
    sheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    XLSX.utils.book_append_sheet(wb, sheet, "COA");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `${coa.coaNumber}.xlsx`;

    return new NextResponse(buffer as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function statusBadge(status: string): string {
  return status === "Pass" ? "✓ PASS" : status === "Fail" ? "✗ FAIL" : status === "OOS" ? "⚠ OOS" : status;
}
