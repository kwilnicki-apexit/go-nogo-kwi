// frontend/src/api/client.ts
import type { ChatRequest, ChatResponse, ExportRequest, RagIndexRequest, RagIndexResponse } from '../types';

const getBaseUrl = (): string => {
  if (window.location.port === '5173') {
    return '/api/v2';
  }
  let path = window.location.pathname.replace(/[^/]*$/, '');
  if (!path.endsWith('/')) path += '/';
  return path + 'api/v2';
};

const BASE_URL = getBaseUrl();

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }

  return res.json();
}

export const api = {
  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    if (req.files && req.files.length > 0) {
      const formData = new FormData();
      formData.append('project_id', req.project_id);
      formData.append('mode', req.mode);
      formData.append('message', req.message);
      formData.append('language', req.language);
      if (req.canvas_content) formData.append('canvas_content', req.canvas_content);
      if (req.rag_context_id) formData.append('rag_context_id', req.rag_context_id);
      req.files.forEach(f => formData.append('files', f));
      return request<ChatResponse>('chat', { method: 'POST', body: formData });
    }

    return request<ChatResponse>('chat', {
      method: 'POST',
      body: JSON.stringify({
        project_id: req.project_id,
        mode: req.mode,
        message: req.message,
        language: req.language,
        canvas_content: req.canvas_content,
        rag_context_id: req.rag_context_id,
      }),
    });
  },

  async exportReport(payload: ExportRequest): Promise<{ filepath: string }> {
    return request<{ filepath: string }>('reports/export', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async connectRag(payload: RagIndexRequest): Promise<RagIndexResponse> {
    return request<RagIndexResponse>('rag/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async disconnectRag(projectId: string): Promise<{ status: string }> {
    return request<{ status: string }>('rag/disconnect', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    });
  },
};