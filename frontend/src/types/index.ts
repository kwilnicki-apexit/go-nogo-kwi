// frontend/src/types/index.ts

export type AppMode = 'chatbot' | 'gonogo' | 'translator' | 'analysis';
export type ThemeMode = 'light' | 'dark';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  mode: AppMode;
  draftData?: StructuredDraft;
  chartPaths?: string[];
}

export interface Project {
  id: string;
  name: string;
  mode: AppMode;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  /** ChromaDB collection ID or S3 prefix for RAG context */
  ragContextId?: string;
  /** Whether RAG indexing is enabled */
  ragEnabled: boolean;
  canvasContent?: string;
  draft?: StructuredDraft;
  chartPaths?: string[];
}

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

export interface ChatRequest {
  project_id: string;
  mode: AppMode;
  message: string;
  language: string;
  canvas_content?: string;
  rag_context_id?: string;
  files?: File[];
}

export interface ChatResponse {
  message: string;
  draft_data?: StructuredDraft;
  chart_paths?: string[];
  canvas_html?: string;
}

export interface AttachedFile {
  file: File;
  id: string;
}

export interface RagIndexRequest {
  project_id: string;
  collection_name: string;
}

export interface RagIndexResponse {
  context_id: string;
  status: string;
  document_count: number;
}

export interface Labels {
  headerTitle: string;
  chatPlaceholder: string;
  newProject: string;
  searchProjects: string;
  canvasTitle: string;
  downloadPdf: string;
  downloadDocx: string;
  downloadMd: string;
  sendMessage: string;
  attachFiles: string;
  modeChatbot: string;
  modeGoNogo: string;
  modeTranslator: string;
  modeAnalysis: string;
  openCanvas: string;
  closeCanvas: string;
  noProjects: string;
  today: string;
  yesterday: string;
  older: string;
  welcome: string;
  welcomeSub: string;
  generatingFile: string;
  successFile: string;
  errorExport: string;
  errorAi: string;
  maxFiles: string;
  newLine: string;
  editName: string;
  archive: string;
  unarchive: string;
  deleteProject: string;
  archived: string;
  active: string;
  confirmDelete: string;
  ragConnect: string;
  ragDisconnect: string;
  ragConnected: string;
  ragIndexing: string;
  ragTooltip: string;
  darkMode: string;
  lightMode: string;
  cancel: string;
  save: string;
  rename: string;
}