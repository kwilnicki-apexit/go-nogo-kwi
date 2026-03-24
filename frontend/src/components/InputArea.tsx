// ============================================================
// FILE: .\frontend\src\components\InputArea.tsx
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Send,
  Paperclip,
  X,
  MessageSquare,
  FileCheck,
  Languages,
  FileSpreadsheet,
  FileIcon,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import type { AppMode, AttachedFile, Labels } from "../types";
import { generateId, formatFileSize } from "../lib/utils";

interface InputAreaProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onSend: (message: string, files: File[]) => void;
  isLoading: boolean;
  labels: Labels;
}

const MAX_FILES = 20;

const modes: {
  key: AppMode;
  icon: React.ReactNode;
  labelKey: keyof Labels;
  color: string;
  activeBg: string;
  activeRing: string;
}[] = [
  {
    key: "chatbot",
    icon: <MessageSquare size={15} />,
    labelKey: "modeChatbot",
    color: "#3b82f6",
    activeBg: "rgba(59,130,246,0.08)",
    activeRing: "rgba(59,130,246,0.35)",
  },
  {
    key: "gonogo",
    icon: <FileCheck size={15} />,
    labelKey: "modeGoNogo",
    color: "#e3000f",
    activeBg: "rgba(227,0,15,0.06)",
    activeRing: "rgba(227,0,15,0.35)",
  },
  {
    key: "translator",
    icon: <Languages size={15} />,
    labelKey: "modeTranslator",
    color: "#16a34a",
    activeBg: "rgba(22,163,74,0.06)",
    activeRing: "rgba(22,163,74,0.35)",
  },
];

const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "xls" || ext === "xlsx")
    return <FileSpreadsheet size={14} color="#16a34a" />;
  if (ext === "pdf") return <FileIcon size={14} color="#e3000f" />;
  return <FileIcon size={14} color="var(--color-text-tertiary)" />;
};

export const InputArea = ({
  mode,
  onModeChange,
  onSend,
  isLoading,
  labels,
}: InputAreaProps) => {
  const [text, setText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    onSend(
      trimmed,
      attachedFiles.map((af) => af.file),
    );
    setText("");
    setAttachedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles: AttachedFile[] = Array.from(e.target.files).map((f) => ({
      file: f,
      id: generateId("f"),
    }));
    setAttachedFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES));
  };

  const removeFile = (id: string) =>
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));

  const canSend = text.trim() || attachedFiles.length > 0;
  const activeModeDetails = modes.find((m) => m.key === mode) || modes[0];

  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        padding: "20px 24px 24px",
        flexShrink: 0,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* File chips */}
        {attachedFiles.length > 0 && (
          <div
            className="custom-scrollbar"
            style={{
              display: "flex",
              flexWrap:
                "nowrap",
              overflowX: "auto",
              overflowY: "hidden",
              gap: 8,
              marginBottom: 14,
              paddingBottom: 8,
            }}
          >
            {attachedFiles.map((af) => (
              <div
                key={af.id}
                className="animate-fade-in-up"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-secondary)",
                  padding: "8px 12px",
                  fontSize: 13,
                  flexShrink: 0 /* ZMIANA: Zapobiega "zgniataniu" czipów, gdy brakuje miejsca */,
                }}
              >
                {getFileIcon(af.file.name)}
                <span
                  style={{
                    maxWidth: 150,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {af.file.name}
                </span>
                <span
                  style={{ color: "var(--color-text-muted)", fontSize: 12 }}
                >
                  {formatFileSize(af.file.size)}
                </span>
                <button
                  onClick={() => removeFile(af.id)}
                  style={{
                    padding: 4,
                    borderRadius: "50%",
                    color: "var(--color-text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input box */}
        <div
          className="input-box-wrapper"
          style={
            {
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              padding: "12px 16px",
              "--input-focus-border": activeModeDetails.color,
              "--input-focus-shadow": `0 0 0 2px ${activeModeDetails.activeRing}, 0 4px 16px rgba(0, 0, 0, 0.08)`,
            } as React.CSSProperties
          }
        >
          {/* Attach button */}
          <button
            className="input-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title={labels.attachFiles}
            style={{ flexShrink: 0 }}
          >
            <Paperclip size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xls,.xlsx,.pdf,.json,.xml,.txt"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={labels.chatPlaceholder}
            rows={1}
            disabled={isLoading}
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
              padding: "10px 4px",
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--color-text-primary)",
              fontFamily: "inherit",
              maxHeight: 200,
              opacity: isLoading ? 0.5 : 1,
            }}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
          />

          {/* Kontener na przyciski akcji po prawej stronie */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* --- IKONKA POMOCY (INSTRUKCJA) --- */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <button
                onMouseEnter={() => setShowHelp(true)}
                onMouseLeave={() => setShowHelp(false)}
                onClick={() => setShowHelp(!showHelp)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-text-tertiary)",
                  padding: "8px",
                  borderRadius: "50%",
                  transition: "background-color 0.15s, color 0.15s",
                  cursor: "pointer",
                  border: "none",
                  backgroundColor: "transparent",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "var(--color-text-primary)";
                  e.currentTarget.style.backgroundColor =
                    "var(--color-surface-tertiary)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "var(--color-text-tertiary)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <HelpCircle size={20} />
              </button>

              {/* POP-UP Z INSTRUKCJĄ (Wyrównany do prawej!) */}
              {showHelp && (
                <div
                  className="animate-fade-in-up"
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    right:
                      "0" /* ZMIANA: wyrównanie do prawej krawędzi ikony */,
                    marginBottom: "16px",
                    width: "380px",
                    padding: "16px",
                    borderRadius: "12px",
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                    zIndex: 100,
                    fontSize: "12.5px",
                    lineHeight: "1.5",
                    color: "var(--color-text-secondary)",
                    pointerEvents: "none",
                  }}
                >
                  <strong
                    style={{
                      color: "var(--color-text-primary)",
                      fontSize: "14px",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    {labels.sendMessage === "Wyślij"
                      ? "Jak działa asystent?"
                      : "How does the assistant work?"}
                  </strong>
                  <ul
                    style={{
                      paddingLeft: "16px",
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <li>
                      <strong>Chatbot:</strong>{" "}
                      {labels.sendMessage === "Wyślij"
                        ? "Zadawaj dowolne pytania. Chatbot widzi pliki załączone w oknie czatu oraz wiedzę z projektu."
                        : "Ask any questions. Chatbot reads files attached below and project knowledge."}
                    </li>
                    <li>
                      <strong>Go/No-Go:</strong>{" "}
                      {labels.sendMessage === "Wyślij"
                        ? "Załącz testy (CSV/XLS), a asystent wygeneruje raport decyzyjny (GO lub NO-GO) i wykresy."
                        : "Attach tests (CSV/XLS) to generate a Go/No-Go decision report and charts."}
                    </li>
                    <li>
                      <strong>Tłumacz:</strong>{" "}
                      {labels.sendMessage === "Wyślij"
                        ? "Tłumaczy tekst z plików, z pola wejściowego, a jeśli ich brak - przedostatnią wiadomość."
                        : "Translates files, text input, or the previous message if empty."}
                    </li>
                  </ul>
                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid var(--color-border)",
                      color: "var(--color-text-tertiary)",
                      fontSize: "11px",
                    }}
                  >
                    {labels.sendMessage === "Wyślij"
                      ? "💡 Wskazówka: Sztuczna inteligencja automatycznie przełącza tryb na podstawie Twojego polecenia."
                      : "💡 Tip: AI automatically switches the mode based on your prompt."}
                  </div>
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              className={`input-send-btn ${canSend && !isLoading ? "enabled" : "disabled"}`}
              onClick={handleSend}
              disabled={isLoading || !canSend}
              style={{ flexShrink: 0 }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* Mode buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {modes.map((m) => {
              const isActive = mode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => onModeChange(m.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "9px 18px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    backgroundColor: isActive ? m.activeBg : "transparent",
                    color: isActive ? m.color : "var(--color-text-secondary)",
                    boxShadow: isActive
                      ? `inset 0 0 0 1.5px ${m.activeRing}`
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-surface-tertiary)";
                      e.currentTarget.style.color = m.color;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color =
                        "var(--color-text-secondary)";
                    }
                  }}
                >
                  {m.icon}
                  <span>{labels[m.labelKey]}</span>
                </button>
              );
            })}
            <button
              onClick={() =>
                window.open("https://bmc-remedy-agent.local", "_blank")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "9px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                backgroundColor: "transparent",
                color: "var(--color-text-secondary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--color-surface-tertiary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title={labels.modeRemedy}
            >
              <ExternalLink size={15} />
              <span>{labels.modeRemedy}</span>
            </button>
          </div>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            Enter ↵ {labels.sendMessage} · Shift+Enter {labels.newLine}
          </span>
        </div>
      </div>
    </div>
  );
};
