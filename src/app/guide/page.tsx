import type { Metadata } from "next";
import { promises as fs } from "node:fs";
import path from "node:path";

export const metadata: Metadata = {
  title: "User guide — Opencode Provider Setup",
  description:
    "How to add, test, and manage AI providers in the Opencode Provider Setup tool.",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Inline formatting for already-escaped text: `code`, **bold**, [label](url).
function inline(md: string): string {
  let out = md.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
  return out;
}

function renderTable(header: string[], rows: string[][]): string {
  const th = header.map((c) => `<th>${inline(c.trim())}</th>`).join("");
  const tb = rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td>${inline(c.trim())}</td>`).join("")}</tr>`
    )
    .join("");
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`;
}

// Minimal renderer for the guide's markdown subset: headings, blockquotes,
// fenced code, tables, lists, paragraphs. Everything is escaped first, so
// guide content can never inject markup or scripts.
function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const html: string[] = [];
  let i = 0;
  let list: "ul" | "ol" | null = null;

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (line.startsWith("```")) {
      closeList();
      const lang = escapeHtml(line.slice(3).trim());
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // Skip closing fence.
      html.push(
        `<pre><code${lang ? ` data-lang="${lang}"` : ""}>${buf.join("\n")}</code></pre>`
      );
      continue;
    }

    // Table: header row + separator row + body rows.
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      /^\|?[\s:|-]+\|?[\s:|-]*$/.test(lines[i + 1].trim()) &&
      lines[i + 1].includes("-")
    ) {
      closeList();
      const header = line.split("|").slice(1, -1);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].split("|").slice(1, -1));
        i++;
      }
      html.push(renderTable(header, rows));
      continue;
    }

    // Headings.
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const level = h[1].length + 1; // Guide title is the page h1.
      html.push(`<h${level}>${inline(escapeHtml(h[2]))}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote.
    if (line.startsWith(">")) {
      closeList();
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        buf.push(inline(escapeHtml(lines[i].replace(/^>\s?/, ""))));
        i++;
      }
      html.push(`<blockquote>${buf.join("<br />")}</blockquote>`);
      continue;
    }

    // Lists.
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        html.push(`<${kind}>`);
        list = kind;
      }
      html.push(`<li>${inline(escapeHtml((ul ?? ol)![1]))}</li>`);
      i++;
      continue;
    }

    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    closeList();
    html.push(`<p>${inline(escapeHtml(line.trim()))}</p>`);
    i++;
  }
  closeList();
  return html.join("\n");
}

export default async function GuidePage() {
  let body: string;
  try {
    const file = await fs.readFile(
      path.join(process.cwd(), "docs", "USER_GUIDE.md"),
      "utf8"
    );
    body = renderMarkdown(file);
  } catch {
    body =
      "<p>Could not load the user guide. Please open <code>docs/USER_GUIDE.md</code> in the project folder.</p>";
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      {/* Apply the persisted theme (set on the main page) before paint. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.classList.toggle("dark",t==="dark");}else if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark");}}catch(e){}})();`,
        }}
      />
      <a
        href="/"
        className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold transition duration-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:hover:bg-slate-800"
      >
        ← Back to setup · عودة إلى الإعداد
      </a>
      <article
        className="guide animate-enter mt-6 rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/10 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-black/40 dark:ring-slate-800 sm:p-8"
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <style>{`
        .guide { line-height: 1.7; font-size: 0.95rem; }
        .guide h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 0.5rem; }
        .guide h2 { font-size: 1.2rem; font-weight: 650; margin: 1.75rem 0 0.5rem; padding-top: 1rem; border-top: 1px solid rgb(226 232 240); }
        .dark .guide h2 { border-top-color: rgb(30 41 59); }
        .guide h3 { font-size: 1.02rem; font-weight: 650; margin: 1.25rem 0 0.375rem; }
        .guide h4 { font-size: 0.95rem; font-weight: 650; margin: 1rem 0 0.25rem; }
        .guide p { margin: 0.5rem 0; color: rgb(51 65 85); }
        .dark .guide p { color: rgb(203 213 225); }
        .guide ul, .guide ol { margin: 0.5rem 0 0.5rem 1.25rem; display: grid; gap: 0.375rem; }
        .guide ul { list-style: disc; }
        .guide ol { list-style: decimal; }
        .guide li { color: rgb(51 65 85); }
        .dark .guide li { color: rgb(203 213 225); }
        .guide code { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 0.83em; background: rgb(241 245 249); border-radius: 0.375rem; padding: 0.1rem 0.35rem; }
        .dark .guide code { background: rgb(30 41 59); }
        .guide pre { margin: 0.75rem 0; overflow-x: auto; border-radius: 0.75rem; background: rgb(15 23 42); padding: 0.875rem 1rem; }
        .guide pre code { background: transparent; color: rgb(226 232 240); padding: 0; }
        .guide blockquote { margin: 0.75rem 0; border-inline-start: 3px solid rgb(37 99 235); background: rgb(239 246 255); border-radius: 0.5rem; padding: 0.625rem 0.875rem; font-size: 0.88rem; }
        .dark .guide blockquote { background: rgb(15 23 42); }
        .guide a { color: rgb(37 99 235); text-decoration: underline; text-underline-offset: 2px; }
        .guide .table-wrap { overflow-x: auto; margin: 0.75rem 0; border-radius: 0.75rem; border: 1px solid rgb(226 232 240); }
        .dark .guide .table-wrap { border-color: rgb(51 65 80); }
        .guide table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .guide th, .guide td { text-align: start; padding: 0.5rem 0.75rem; border-bottom: 1px solid rgb(226 232 240); vertical-align: top; }
        .dark .guide th, .dark .guide td { border-bottom-color: rgb(51 65 80); }
        .guide thead th { background: rgb(248 250 252); font-weight: 650; }
        .dark .guide thead th { background: rgb(15 23 42); }
        .guide tbody tr:last-child td { border-bottom: 0; }
      `}</style>
    </main>
  );
}
