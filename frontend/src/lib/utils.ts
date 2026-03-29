// ============================================================
// FILE: .\frontend\src\lib\utils.ts
// ============================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StructuredDraft } from "../types";

/** Merges Tailwind CSS class names with clsx for conditional logic. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generates a short random ID with a prefix. */
export function generateId(prefix: "c" | "p" | "m" | "f" = "c"): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
}

/** Formats byte count into a human-readable file size string. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formats a Date into HH:MM time string. */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Extracts initials (up to 2 chars) from a display name. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Strips HTML tags and converts common entities to plain text. */
export function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p><p>/gi, "\n\n");
  text = text.replace(/<\/li><li>/gi, "\n- ");
  text = text.replace(/<li>/gi, "- ");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/** Converts a structured draft object into HTML for the Quill editor. */
export function draftToHtml(draft: StructuredDraft, isPl: boolean) {
  const sections = [
    { heading: isPl ? "Podsumowanie" : "Summary", content: draft.summary },
    {
      heading: isPl ? "Analiza testów" : "Test Analysis",
      content: (() => {
        const rows = Array.isArray(draft.test_analysis)
          ? draft.test_analysis
          : [];
        if (rows.length === 0)
          return `<p>${isPl ? "Brak testów." : "No tests."}</p>`;

        let html = `<p style="font-family: monospace; white-space: pre-wrap;">`;
        html += `| ${isPl ? "Nazwa testu" : "Test Name"} | ${isPl ? "Wynik" : "Result"} | ${isPl ? "Plik" : "File"} |<br>`;
        html += `|---|---|---|<br>`;

        rows.forEach((r) => {
          const testName = (r.test_name || "-").replace(/\|/g, "");
          const value = (r.value || "-").replace(/\|/g, "");
          const filename = (r.filename || "-").replace(/\|/g, "");
          html += `| ${testName} | **${value}** | ${filename} |<br>`;
        });

        html += `</p>`;
        return html;
      })(),
    },
    {
      heading: isPl ? "Ocena ryzyk" : "Risk Evaluation",
      content: (() => {
        const rows = Array.isArray(draft.risks_eval) ? draft.risks_eval : [];
        if (rows.length === 0)
          return `<p style="color:#64748b; font-style:italic;">${isPl ? "Brak zidentyfikowanych ryzyk." : "No risks identified."}</p>`;

        // Budujemy tabelę ryzyk
        let html = `<p style="font-family: monospace; white-space: pre-wrap;">`;
        html += `| ${isPl ? "Test" : "Test"} | ${isPl ? "Poziom" : "Severity"} | ${isPl ? "Powód" : "Reason"} |<br>`;
        html += `|---|---|---|<br>`;

        rows.forEach((r) => {
          const testName = (r.test_name || "-").replace(/\|/g, "");
          const severity = (r.severity || "-").replace(/\|/g, "");
          const reason = (r.reason || "-").replace(/\|/g, "");
          html += `| ${testName} | **${severity}** | ${reason} |<br>`;
        });

        html += `</p>`;
        return html;
      })(),
    },
    {
      heading: isPl ? "Decyzja" : "Decision",
      content: `<p style="font-size:1.5em"><strong style="color:${draft.decision === "GO" ? "#10b981" : "#ef4444"}">${draft.decision}</strong></p>`,
    },
    {
      heading: isPl ? "Uzasadnienie" : "Justification",
      content: `<p>${draft.justification}</p>`,
    },
  ];

  return sections
    .filter((s) => s.content)
    .map((s) => `<h2>${s.heading}</h2>\n${s.content}`)
    .join("\n\n");
}

/** Converts basic HTML to Markdown for export. */
export function htmlToMarkdown(html: string): string {
  let md = html;

  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match) => {
    let markdownTable = "\n\n";
    const rows = match.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

    rows.forEach((row, index) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];

      const rowText =
        "| " +
        cells.map((c) => c.replace(/<[^>]+>/g, "").trim()).join(" | ") +
        " |\n";
      markdownTable += rowText;

      if (index === 0) {
        markdownTable += "| " + cells.map(() => "---").join(" | ") + " |\n";
      }
    });
    return markdownTable + "\n";
  });

  md = md.replace(/<h1>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<ul>/gi, "\n");
  md = md.replace(/<\/ul>/gi, "\n\n");
  md = md.replace(/<li>(.*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<p>/gi, "");
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<br\s*[/]?>/gi, "\n");

  md = md.replace(/<table[^>]*>/gi, "\n\n");
  md = md.replace(/<\/table>/gi, "\n\n");
  md = md.replace(/<tr[^>]*>/gi, "| ");
  md = md.replace(/<\/tr>/gi, " |\n");
  md = md.replace(/<th[^>]*>(.*?)<\/th>/gi, "$1 | ");
  md = md.replace(/<td[^>]*>(.*?)<\/td>/gi, "$1 | ");

  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/&nbsp;/gi, " ");

  return md.trim();
}
