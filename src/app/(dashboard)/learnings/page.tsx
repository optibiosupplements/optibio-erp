import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Lightbulb, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LearningsPage() {
  let content = "";
  try {
    content = readFileSync(join(process.cwd(), "docs/LEARNINGS.md"), "utf8");
  } catch {
    content = "# Learnings\n\nCould not load `docs/LEARNINGS.md`.";
  }

  // Parse the markdown into entries (simple split on H2 headers)
  const lines = content.split("\n");
  const intro: string[] = [];
  const entries: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let inIntro = true;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) entries.push(current);
      current = { title: line.replace(/^##\s+/, ""), lines: [] };
      inIntro = false;
    } else if (current) {
      current.lines.push(line);
    } else if (inIntro && !line.startsWith("# ")) {
      intro.push(line);
    }
  }
  if (current) entries.push(current);

  const realEntries = entries.filter((e) => !e.title.toLowerCase().includes("template for new entries"));

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[#d10a11]" />
            Learnings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {realEntries.length} entr{realEntries.length === 1 ? "y" : "ies"} · institutional knowledge log
          </p>
        </div>
      </div>

      {/* Intro */}
      <section className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 text-xs text-slate-600">
        <div className="flex items-start gap-2">
          <BookOpen className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-slate-700 mb-1">What this is</p>
            <p className="leading-relaxed">
              Cross-session institutional knowledge. Every question answered here is one we don't have to re-discover.
              Add an entry whenever something surprised you, took &gt;5 minutes to figure out, or contradicted an assumption.
              Source: <code className="font-mono bg-white px-1 py-0.5 rounded text-[11px]">docs/LEARNINGS.md</code>
            </p>
          </div>
        </div>
      </section>

      {/* Entries */}
      {realEntries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <Lightbulb className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No learnings logged yet.</p>
          <p className="text-xs text-slate-400 mt-1">Add to <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">docs/LEARNINGS.md</code> in the repo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {realEntries.map((entry, i) => {
            const dateMatch = entry.title.match(/^(\d{4}-\d{2}-\d{2})\s*—\s*(.*)$/);
            const date = dateMatch?.[1];
            const title = dateMatch?.[2] ?? entry.title;
            return (
              <article key={i} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                  {date && <time className="text-xs text-slate-400 font-mono whitespace-nowrap">{date}</time>}
                </div>
                <div className="prose prose-sm prose-slate max-w-none">
                  {entry.lines.map((line, j) => {
                    if (!line.trim()) return <br key={j} />;
                    if (line.startsWith("**") && line.endsWith("**")) {
                      return <p key={j} className="text-xs font-semibold text-slate-700 mt-2">{line.replace(/\*\*/g, "")}</p>;
                    }
                    if (line.startsWith("**")) {
                      const m = line.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
                      if (m) {
                        return (
                          <p key={j} className="text-sm text-slate-700 leading-relaxed my-1">
                            <span className="font-semibold text-slate-800">{m[1]}</span>{" "}
                            <span dangerouslySetInnerHTML={{ __html: renderInline(m[2]) }} />
                          </p>
                        );
                      }
                    }
                    return (
                      <p key={j} className="text-sm text-slate-600 leading-relaxed my-1" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderInline(text: string): string {
  // Render markdown inline code as <code>
  return text
    .replace(/`([^`]+)`/g, '<code class="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-800">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#d10a11] hover:underline">$1</a>');
}
