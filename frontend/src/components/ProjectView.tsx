// ============================================================
// FILE: .\frontend\src\components\ProjectView.tsx
// ============================================================

import { useState, useRef } from "react";
import {
  Copy,
  CheckCircle,
  Save,
  UploadCloud,
  FileText,
  Send,
  Bot,
  Trash2,
  MessageSquare,
  FileCheck,
  Languages,
  BarChart3,
  FolderOpen,
} from "lucide-react";
import type { Project, Chat, Labels, AppMode } from "../types";
import { formatTime } from "../lib/utils";

interface ProjectViewProps {
  project: Project;
  projectChats: Chat[];
  instructions: string;
  onInstructionsChange: (val: string) => void;
  onSaveInstructions: () => void;
  saveSuccess: boolean;
  onNameChange: (name: string) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onQuickChat: (message: string, mode: AppMode) => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  isLoading: boolean;
  labels: Labels;
}

const MODE_OPTIONS: {
  key: AppMode;
  icon: React.ReactNode;
  color: string;
  activeBg: string;
  activeRing: string;
  labelKey: keyof Labels;
}[] = [
  {
    key: "chatbot",
    icon: <MessageSquare size={14} />,
    color: "#3b82f6",
    activeBg: "rgba(59,130,246,0.08)",
    activeRing: "rgba(59,130,246,0.35)",
    labelKey: "modeChatbot",
  },
  {
    key: "gonogo",
    icon: <FileCheck size={14} />,
    color: "#e3000f",
    activeBg: "rgba(227,0,15,0.06)",
    activeRing: "rgba(227,0,15,0.35)",
    labelKey: "modeGoNogo",
  },
  {
    key: "translator",
    icon: <Languages size={14} />,
    color: "#16a34a",
    activeBg: "rgba(22,163,74,0.06)",
    activeRing: "rgba(22,163,74,0.35)",
    labelKey: "modeTranslator",
  },
  {
    key: "analysis",
    icon: <BarChart3 size={14} />,
    color: "#d97706",
    activeBg: "rgba(217,119,6,0.06)",
    activeRing: "rgba(217,119,6,0.35)",
    labelKey: "modeAnalysis",
  },
];

export const ProjectView = ({
  project,
  projectChats,
  instructions,
  onInstructionsChange,
  onSaveInstructions,
  saveSuccess,
  onNameChange,
  onUploadFiles,
  onQuickChat,
  onSelectChat,
  onDeleteChat,
  isLoading,
  labels,
}: ProjectViewProps) => {
  const [copiedId, setCopiedId] = useState(false);
  const [quickInput, setQuickInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<AppMode>("chatbot");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyId = () => {
    navigator.clipboard.writeText(project.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleQuickSubmit = () => {
    if (!quickInput.trim()) return;
    onQuickChat(quickInput.trim(), selectedMode);
    setQuickInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickSubmit();
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) onUploadFiles(e.dataTransfer.files);
  };

  return (
    <div
      className="flex-1 overflow-y-auto custom-scrollbar"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px" }}>
        {/* ── Title row ── */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, rgba(227,0,15,0.1), rgba(227,0,15,0.04))",
                border: "1px solid rgba(227,0,15,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FolderOpen size={18} color="#e3000f" />
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              {labels.projectSettings}
            </h1>
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-tertiary)",
              margin: 0,
              paddingLeft: 48,
            }}
          >
            {labels.projectSettingsSub}
          </p>
        </div>

        {/* ── Two-column grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* ════════════════════════════════════════════
              LEFT COLUMN
              ════════════════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Project ID */}
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>{labels.projectId}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface-secondary)",
                    fontSize: 13,
                    fontFamily: "monospace",
                    color: "var(--color-text-tertiary)",
                    userSelect: "all",
                  }}
                >
                  {project.id}
                </div>
                <button
                  onClick={handleCopyId}
                  style={iconBtnStyle}
                  title="Copy ID"
                >
                  {copiedId ? (
                    <CheckCircle size={15} color="#22c55e" />
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
              </div>
            </div>

            {/* Project Name */}
            <div style={{ marginBottom: 24 }}>
              <label style={fieldLabelStyle}>{labels.projectName}</label>
              <input
                value={project.name}
                onChange={(e) => onNameChange(e.target.value)}
                style={textInputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            </div>

            {/* ── Chat input area ── */}
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                overflow: "hidden",
                marginBottom: 24,
              }}
            >
              {/* Textarea */}
              <div style={{ padding: "14px 16px 10px" }}>
                <textarea
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={labels.writeFirstMessage}
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "none",
                    border: "none",
                    outline: "none",
                    backgroundColor: "transparent",
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--color-text-primary)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Bottom bar: modes + send */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderTop: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-secondary)",
                }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  {MODE_OPTIONS.map((m) => {
                    const isActive = selectedMode === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setSelectedMode(m.key)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          backgroundColor: isActive
                            ? m.activeBg
                            : "transparent",
                          color: isActive
                            ? m.color
                            : "var(--color-text-tertiary)",
                          boxShadow: isActive
                            ? `inset 0 0 0 1.5px ${m.activeRing}`
                            : "none",
                        }}
                      >
                        {m.icon}
                        <span>{labels[m.labelKey]}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleQuickSubmit}
                  disabled={!quickInput.trim()}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    cursor: quickInput.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                    backgroundColor: quickInput.trim()
                      ? "var(--color-orlen)"
                      : "var(--color-surface-tertiary)",
                    color: quickInput.trim()
                      ? "#fff"
                      : "var(--color-text-muted)",
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            {/* ── Project chats list ── */}
            <div>
              <label style={{ ...fieldLabelStyle, marginBottom: 10 }}>
                {labels.recentChatsSection}
                {projectChats.length > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      backgroundColor: "var(--color-surface-tertiary)",
                      color: "var(--color-text-tertiary)",
                      padding: "2px 7px",
                      borderRadius: 10,
                    }}
                  >
                    {projectChats.length}
                  </span>
                )}
              </label>

              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  overflow: "hidden",
                }}
              >
                {projectChats.length === 0 ? (
                  <div
                    style={{
                      padding: "28px 16px",
                      textAlign: "center",
                      color: "var(--color-text-muted)",
                      fontSize: 13,
                    }}
                  >
                    {labels.noProjects}
                  </div>
                ) : (
                  <div
                    style={{ maxHeight: 260, overflowY: "auto" }}
                    className="custom-scrollbar"
                  >
                    {projectChats.map((chat, idx) => (
                      <div
                        key={chat.id}
                        onClick={() => onSelectChat(chat.id)}
                        className="group"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          cursor: "pointer",
                          borderTop:
                            idx > 0 ? "1px solid var(--color-border)" : "none",
                          transition: "background-color 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--color-surface-secondary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <Bot
                            size={14}
                            color="#3b82f6"
                            style={{ flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "var(--color-text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {chat.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--color-text-muted)",
                                marginTop: 1,
                              }}
                            >
                              {chat.messages.length} msg ·{" "}
                              {formatTime(chat.updatedAt)}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChat(chat.id);
                          }}
                          className="opacity-0 group-hover:opacity-100"
                          style={{
                            padding: 4,
                            borderRadius: 4,
                            flexShrink: 0,
                            color: "var(--color-text-muted)",
                            transition: "all 0.12s",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#ef4444";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color =
                              "var(--color-text-muted)";
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════
              RIGHT COLUMN
              ════════════════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* ── Instructions editor ── */}
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-secondary)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {labels.systemPromptLabel}
                </span>
                <button
                  onClick={onSaveInstructions}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--color-orlen)",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    transition: "opacity 0.15s",
                  }}
                >
                  {saveSuccess ? <CheckCircle size={13} /> : <Save size={13} />}
                  {saveSuccess ? labels.saved : labels.saveBtn}
                </button>
              </div>

              {/* Editor area */}
              <textarea
                value={instructions}
                onChange={(e) => onInstructionsChange(e.target.value)}
                placeholder={labels.chatPlaceholder}
                style={{
                  width: "100%",
                  minHeight: 200,
                  resize: "vertical",
                  border: "none",
                  outline: "none",
                  backgroundColor: "transparent",
                  padding: 16,
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: "var(--color-text-primary)",
                  fontFamily: "'Roboto Mono', monospace",
                }}
              />
            </div>

            {/* ── File upload (drag & drop) ── */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              style={{
                position: "relative",
                borderRadius: 12,
                border: `2px dashed ${isDragging ? "var(--color-orlen)" : "var(--color-border)"}`,
                backgroundColor: isDragging
                  ? "rgba(227,0,15,0.03)"
                  : "var(--color-surface)",
                padding: 20,
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Loading overlay */}
              {isLoading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(var(--color-surface), 0.6)",
                    backdropFilter: "blur(4px)",
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--color-orlen)",
                    }}
                    className="animate-pulse"
                  >
                    {labels.uploadingAndVectorizing}
                  </span>
                </div>
              )}

              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {labels.projectKnowledgeBase}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {labels.projectKnowledgeBaseSub}
                  </div>
                </div>
                <label
                  style={{
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface-secondary)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  <UploadCloud size={14} /> {labels.uploadBtn}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    style={{ display: "none" }}
                    onChange={(e) =>
                      e.target.files && onUploadFiles(e.target.files)
                    }
                  />
                </label>
              </div>

              {/* File list */}
              <div
                style={{ maxHeight: 200, overflowY: "auto" }}
                className="custom-scrollbar"
              >
                {!project.uploadedFiles ||
                project.uploadedFiles.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 0",
                      color: "var(--color-text-muted)",
                      fontSize: 13,
                    }}
                  >
                    {labels.noUploadedFiles}
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {project.uploadedFiles.map((file, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-surface-secondary)",
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        <FileText
                          size={14}
                          color="#3b82f6"
                          style={{ flexShrink: 0 }}
                        />
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {file}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Shared inline styles ──

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--color-text-secondary)",
  marginBottom: 6,
};

const textInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
  fontSize: 14,
  color: "var(--color-text-primary)",
  outline: "none",
  transition: "border-color 0.15s",
};

const iconBtnStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--color-text-tertiary)",
  transition: "all 0.15s",
  flexShrink: 0,
};

const focusHandler = (
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) => {
  e.currentTarget.style.borderColor = "var(--color-orlen)";
};

const blurHandler = (
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) => {
  e.currentTarget.style.borderColor = "var(--color-border)";
};
