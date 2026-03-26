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

export function draftToMarkdown(draft: StructuredDraft, isPl: boolean): string {
  const sections = [
    { heading: isPl ? "Podsumowanie" : "Summary", content: draft.summary },
    {
      heading: isPl ? "Analiza Testów" : "Test Analysis",
      content: (() => {
        const rows = Array.isArray(draft.test_analysis) ? draft.test_analysis : [];
        let mdTable = "";
        
        if (rows.length > 0) {
          mdTable += `| ${isPl ? "Nazwa testu" : "Test name"} | ${isPl ? "Wynik" : "Value"} | ${isPl ? "Plik" : "File"} |\n`;
          mdTable += `|---|---|---|\n`;
          rows.forEach((r) => {
            mdTable += `| ${r.test_name || ""} | **${r.value || ""}** | _${r.filename || ""}_ |\n`;
          });
        }

        const summary = draft.test_analysis_summary 
          ? `\n> ${draft.test_analysis_summary}` 
          : "";

        return mdTable + summary;
      })(),
    },
    {
      heading: isPl ? "Ocena ryzyk" : "Risk Evaluation",
      content: draft.risks_eval,
    },
    {
      heading: isPl ? "Decyzja" : "Decision",
      content: `## ${draft.decision}`,
    },
    {
      heading: isPl ? "Uzasadnienie" : "Justification",
      content: draft.justification,
    },
  ];

  return sections
    .filter((s) => s.content)
    .map((s) => `## ${s.heading}\n\n${s.content}`)
    .join("\n\n---\n\n");
}