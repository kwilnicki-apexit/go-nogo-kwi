// ============================================================
// FILE: .\frontend\src\components\CanvasPanel.tsx
// ============================================================

import { useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { X, Download, FileType2, FileCode } from "lucide-react";
import type { Labels } from "../types";

interface CanvasPanelProps {
  isOpen: boolean;
  content: string;
  onChange: (content: string) => void;
  onClose: () => void;
  onExport: (format: "pdf" | "docx" | "md", addToRag: boolean) => void;
  exportMessage: string;
  labels: Labels;
}

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ color: [] }, { background: [] }],
    ["blockquote", "code-block"],
    ["clean"],
  ],
};

const QUILL_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "color",
  "background",
  "blockquote",
  "code-block",
];

const exportBtnStyle = (): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "9px 18px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  transition: "all 0.15s",
});

/**
 * Determines if an export status message indicates an error.
 * Checks both Polish and English error keywords.
 */
function isErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes("błąd") || lower.includes("error");
}

export const CanvasPanel = ({
  isOpen,
  content,
  onChange,
  onClose,
  onExport,
  exportMessage,
  labels,
}: CanvasPanelProps) => {
  const quillRef = useRef<ReactQuill>(null);
  const [addToRag, setAddToRag] = useState(true);
  
  if (!isOpen) return null;

  const isError = isErrorMessage(exportMessage);

  return (
    <div
      className="animate-slide-in-right"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        borderLeft: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface-secondary)",
          padding: "16px 24px",
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          {labels.canvasTitle}
        </h3>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={addToRag} 
              onChange={(e) => setAddToRag(e.target.checked)} 
              style={{ cursor: "pointer" }}
            />
            {labels.downloadPdf === "PDF" ? "Zapisz do bazy wiedzy (RAG)" : "Save to Knowledge Base (RAG)"}
          </label>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => onExport("pdf", addToRag)}
            style={exportBtnStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#fca5a5";
              e.currentTarget.style.color = "#e3000f";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            <Download size={14} /> {labels.downloadPdf}
          </button>
          <button
            onClick={() => onExport("docx", addToRag)}
            style={exportBtnStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#93c5fd";
              e.currentTarget.style.color = "#3b82f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            <FileType2 size={14} /> {labels.downloadDocx}
          </button>
          <button
            onClick={() => onExport("md", addToRag)}
            style={exportBtnStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#9ca3af";
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            <FileCode size={14} /> {labels.downloadMd}
          </button>

          <div
            style={{
              width: 1,
              height: 24,
              backgroundColor: "var(--color-border)",
              margin: "0 8px",
            }}
          />

          <button
            onClick={onClose}
            style={{
              padding: 10,
              borderRadius: 8,
              color: "var(--color-text-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
            title={labels.closeCanvas}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-surface-tertiary)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div
        className="canvas-editor custom-scrollbar"
        style={{ flex: 1, overflowY: "auto" }}
      >
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={content}
          onChange={onChange}
          modules={QUILL_MODULES}
          formats={QUILL_FORMATS}
        />
      </div>

      {/* Status message */}
      {exportMessage && (
        <div
          style={{
            borderTop: "1px solid",
            padding: "12px 24px",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 500,
            borderColor: isError ? "#fca5a5" : "#86efac",
            backgroundColor: isError ? "#fef2f2" : "#f0fdf4",
            color: isError ? "#dc2626" : "#16a34a",
          }}
        >
          {exportMessage}
        </div>
      )}
    </div>
  );
};
