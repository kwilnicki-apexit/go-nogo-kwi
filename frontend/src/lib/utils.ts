// ============================================================
// FILE: .\frontend\src\lib\utils.ts
// ============================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
export function draftToHtml(
  draft: {
    summary: string;
    test_analysis: string;
    risks_eval: string;
    decision: string;
    justification: string;
  },
  isPl: boolean,
): string {
  const sections = [
    { heading: isPl ? "Podsumowanie" : "Summary", content: draft.summary },
    {
      heading: isPl ? "Analiza Testów" : "Test Analysis",
      content: (() => {
        const rows = Array.isArray(draft.test_analysis) ? draft.test_analysis : [];
        const table = rows.length > 0
          ? `<table style="width:100%;border-collapse:collapse;font-size:0.9em;margin-bottom:12px">
              <thead>
                <tr>
                  <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #e2e8f0">${isPl ? "Nazwa testu" : "Test name"}</th>
                  <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #e2e8f0">${isPl ? "Wynik" : "Value"}</th>
                  <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #e2e8f0">${isPl ? "Plik" : "File"}</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `<tr>
                  <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${r.test_name}</td>
                  <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${r.value}</td>
                  <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:0.85em">${r.filename}</td>
                </tr>`).join("")}
              </tbody>
            </table>`
          : "";
        const summary = draft.test_analysis_summary
          ? `<p style="margin-top:8px;color:#475569;font-style:italic">${draft.test_analysis_summary}</p>`
          : "";
        return table + summary;
      })(),
    },
    {
      heading: isPl ? "Ocena ryzyk" : "Risk Evaluation",
      content: draft.risks_eval,
    },
    {
      heading: isPl ? "Decyzja" : "Decision",
      content: `<strong style="font-size:1.3em;color:${draft.decision === "GO" ? "#10b981" : "#ef4444"}">${draft.decision}</strong>`,
    },
    {
      heading: isPl ? "Uzasadnienie" : "Justification",
      content: draft.justification,
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
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n");
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/p>\s*<p>/gi, "\n\n");
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/\n{3,}/g, "\n\n");
  return md.trim();
}
