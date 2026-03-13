export interface StructuredDraft {
  summary: string;
  test_analysis: string;
  risks_eval: string;
  decision: string;
  justification: string;
}

export interface DraftResponse {
  draft: StructuredDraft;
  charts: string[];
}

export interface ExportRequest {
  project_name: string;
  edited_text: string;
  format: 'pdf' | 'docx' | 'md';
  language: string;
  author: string;
  chart_paths: string[];
}

export interface SectionConfig {
  key: keyof StructuredDraft;
  labelPl: string;
  labelEn: string;
  icon: string;
}

export type EnabledSections = Record<keyof StructuredDraft, boolean>;

export interface Labels {
  projectParams: string;
  projectName: string;
  reportAuthor: string;
  outputLanguage: string;
  polish: string;
  english: string;
  testFiles: string;
  identifiedRisks: string;
  generateReport: string;
  generating: string;
  addFileHint: string;
  reviewEdit: string;
  reviewHint: string;
  aiRecommendation: string;
  generatedCharts: string;
  exportPdf: string;
  exportDocx: string;
  exportMd: string;
  generatingFile: string;
  successFile: string;
  errorExport: string;
  errorAi: string;
  headerTitle: string;
  sectionEnabled: string;
  sectionDisabled: string;
  selectAll: string;
  deselectAll: string;
  sectionsIncluded: string;
  maxFiles: string;
  fileCount: string;
}