import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships its built-in PostScript Type 1 fonts (Helvetica.afm etc.) as
  // data files relative to its own __dirname. Turbopack rewrites those paths
  // and breaks pdfkit's font loader. Keeping pdfkit external preserves the
  // original resolution so /api/quotes/[id]/pdf and /api/invoices/[id]/pdf
  // can render their default Helvetica family. Same applies to xlsx (uses
  // Node's `cpexcel` codepage tables via __dirname).
  serverExternalPackages: ["pdfkit", "xlsx"],
};

export default nextConfig;
