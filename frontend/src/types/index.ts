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
  id: string;               // p-xxxxx
  name: string;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  instructions?: string;
  uploadedFiles?: string[];
}

export interface Chat {
  id: string;               // c-xxxxx
  projectId: string | null;
  name: string;
  mode: AppMode;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
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

export interface ExportRequest {
  project_name: string;
  edited_text: string;
  format: 'pdf' | 'docx' | 'md';
  language: string;
  author: string;
  chart_paths: string[];
}

export interface ChatRequest {
  chat_id: string;
  project_id?: string | null;
  mode: AppMode;
  message: string;
  language: string;
  canvas_content?: string;
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

export interface Labels {
  headerTitle: string;
  chatPlaceholder: string;
  newProject: string;
  newChat: string;
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