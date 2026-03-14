// frontend/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

export function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p><p>/gi, '\n\n');
  text = text.replace(/<\/li><li>/gi, '\n- ');
  text = text.replace(/<li>/gi, '- ');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export function draftToHtml(
  draft: {
    summary: string;
    test_analysis: string;
    risks_eval: string;
    decision: string;
    justification: string;
  },
  isPl: boolean
): string {
  const sections = [
    { heading: isPl ? 'Podsumowanie' : 'Summary', content: draft.summary },
    { heading: isPl ? 'Analiza testów' : 'Test Analysis', content: draft.test_analysis },
    { heading: isPl ? 'Ocena ryzyk' : 'Risk Evaluation', content: draft.risks_eval },
    {
      heading: isPl ? 'Decyzja' : 'Decision',
      content: `<strong style="font-size:1.3em;color:${draft.decision === 'GO' ? '#10b981' : '#ef4444'}">${draft.decision}</strong>`,
    },
    { heading: isPl ? 'Uzasadnienie' : 'Justification', content: draft.justification },
  ];

  return sections
    .filter(s => s.content)
    .map(s => `<h2>${s.heading}</h2>\n${s.content}`)
    .join('\n\n');
}

export function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>\s*<p>/gi, '\n\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}