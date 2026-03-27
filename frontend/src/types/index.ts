// ============================================================
// FILE: .\frontend\src\types\index.ts
// ============================================================

export type AppMode = "chatbot" | "gonogo" | "translator" | "remedy";
export type ThemeMode = "light" | "dark";
export type LangCode = "pl" | "en";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  mode: AppMode;
  draftData?: StructuredDraft;
  chartPaths?: string[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  instructions?: string;
  uploadedFiles?: string[];
}

export interface Chat {
  id: string;
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
  uploadedFiles?: string[];
}

export interface StructuredDraft {
  summary: string;
  test_analysis: { test_name: string; value: string; filename: string }[];
  test_analysis_summary: string;
  risks_eval: { test_name: string; filename: string; value: string; reason: string; severity: "high" | "medium" | "low" }[];
  decision: string;
  justification: string;
}

export interface ExportRequest {
  project_name: string;
  edited_text: string;
  format: "pdf" | "docx" | "md";
  language: string;
  author: string;
  chart_paths: string[];
  add_to_rag: boolean;
}

export interface ChatRequest {
  chat_id: string;
  project_id?: string | null;
  mode: AppMode;
  message: string;
  language: string;
  canvas_content?: string;
  files?: File[];
  chat_history?: { role: string; content: string }[];
}

export interface ChatResponse {
  message: string;
  draft_data?: StructuredDraft;
  chart_paths?: string[];
  canvas_html?: string;
  detected_mode?: AppMode;
}

export interface AttachedFile {
  file: File;
  id: string;
}

export interface UserConfig {
  displayName: string;
  role: string;
  authorName: string;
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
  modeRemedy: string;
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
  projectSettings: string;
  projectSettingsSub: string;
  projectId: string;
  projectName: string;
  startNewRagChat: string;
  startNewRagChatSub: string;
  writeFirstMessage: string;
  systemPromptLabel: string;
  saved: string;
  saveBtn: string;
  uploadingAndVectorizing: string;
  projectKnowledgeBase: string;
  projectKnowledgeBaseSub: string;
  uploadBtn: string;
  noUploadedFiles: string;
  projectContextActive: string;
  newConversation: string;
  uploadedNFiles: string;
  uploadError: string;
  userLabel: string;
  systemQaLabel: string;
  chatbotDesc: string;
  gonogoDesc: string;
  translatorDesc: string;
  analysisDesc: string;
  projectsSection: string;
  recentChatsSection: string;
  changeTheme: string;
  settings: string;
  userSettings: string;
  displayNameLabel: string;
  roleLabel: string;
  authorNameLabel: string;
  authorNameHint: string;
  languageLabel: string;
  polish: string;
  english: string;
  closeSettings: string;
  confirmDeleteMessage: string;
  yes: string;
  no: string;
  archivedBadge: string;
}
