// ============================================================
// FILE: .\frontend\src\api\client.ts
// ============================================================

import type { ChatRequest, ChatResponse, ExportRequest } from "../types";

/**
 * Resolves the API base URL depending on the deployment context.
 * In dev (port 5173), proxies through Vite to /api/v2.
 * In production, resolves relative to the current page path.
 */
const getBaseUrl = (): string => {
  if (window.location.port === "5173") return "/api/v2";

  let path = window.location.pathname.replace(/[^/]*$/, "");
  if (!path.endsWith("/")) path += "/";

  return path + "api/v2";
};

const BASE_URL = getBaseUrl();

/**
 * Generic fetch wrapper with error handling and automatic content-type detection.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}/${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }

  return res.json();
}

export const api = {
  /**
   * Sends a chat message (with optional file attachments) to the backend.
   */
  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    if (req.files && req.files.length > 0) {
      const formData = new FormData();
      formData.append("chat_id", req.chat_id);
      if (req.project_id) formData.append("project_id", req.project_id);
      formData.append("mode", req.mode);
      formData.append("message", req.message);
      formData.append("language", req.language);
      if (req.canvas_content)
        formData.append("canvas_content", req.canvas_content);

      if (req.chat_history) {
        formData.append("chat_history", JSON.stringify(req.chat_history));
      }

      req.files.forEach((f) => formData.append("files", f));
      return request<ChatResponse>("chat", { method: "POST", body: formData });
    }

    return request<ChatResponse>("chat", {
      method: "POST",
      body: JSON.stringify({
        chat_id: req.chat_id,
        project_id: req.project_id || null,
        mode: req.mode,
        message: req.message,
        language: req.language,
        canvas_content: req.canvas_content,
        chat_history: req.chat_history,
      }),
    });
  },

  /**
   * Saves project-level instructions (system prompt) on the backend.
   */
  async updateProjectInstructions(projectId: string, instructions: string) {
    return request(`projects/${projectId}/instructions`, {
      method: "POST",
      body: JSON.stringify({ instructions }),
    });
  },

  /**
   * Uploads knowledge files (PDF, DOCX, TXT) to a project for RAG indexing.
   */
  async uploadProjectFiles(projectId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    return request(`projects/${projectId}/upload`, {
      method: "POST",
      body: formData,
    });
  },

  /**
   * Exports a report to PDF, DOCX, or Markdown format and triggers a download.
   */
  async exportReport(payload: ExportRequest): Promise<void> {
    const url = `${BASE_URL}/reports/export`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`API Error ${res.status}: ${errorText}`);
    }

    const contentDisposition = res.headers.get("Content-Disposition");
    let filename = `Report.${payload.format}`;
    if (contentDisposition) {
      const match = contentDisposition.match(
        /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i,
      );
      if (match && match[1]) {
        filename = decodeURIComponent(match[1]);
      }
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  },

  /**
   * Deletes a file from a chat session.
   */
  async deleteChatFile(
    chatId: string,
    filename: string,
  ): Promise<{ status: string; message: string }> {
    return request(`chat/${chatId}/files/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
  },

  /**
   * Downloads a file from a chat session.
   */
  async downloadChatFile(chatId: string, filename: string): Promise<void> {
    const url = `${BASE_URL}/chat/${chatId}/files/${encodeURIComponent(filename)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to download file");

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  },
};
