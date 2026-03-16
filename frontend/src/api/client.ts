// frontend/src/api/client.ts

import type { ChatRequest, ChatResponse, ExportRequest } from "../types";

const getBaseUrl = (): string => {
  if (window.location.port === "5173") return "/api/v2";

  let path = window.location.pathname.replace(/[^/]*$/, "");

  if (!path.endsWith("/")) path += "/";

  return path + "api/v2";
};

const BASE_URL = getBaseUrl();

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

  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    if (req.files && req.files.length > 0) {
      const formData = new FormData();

      formData.append("chat_id", req.chat_id);

      if (req.project_id) 
        formData.append("project_id", req.project_id);

      formData.append("mode", req.mode);
      formData.append("message", req.message);
      formData.append("language", req.language);

      if (req.canvas_content)
        formData.append("canvas_content", req.canvas_content);
      
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
      }),
    });
  },

  async updateProjectInstructions(projectId: string, instructions: string) {
    return request(`projects/${projectId}/instructions`, {
      method: "POST",
      body: JSON.stringify({ instructions }),
    });
  },

  async uploadProjectFiles(projectId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    return request(`projects/${projectId}/upload`, {
      method: "POST",
      body: formData,
    });
  },

  async exportReport(payload: ExportRequest): Promise<{ filepath: string }> {
    return request<{ filepath: string }>("reports/export", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
