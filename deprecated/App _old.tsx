// frontend/src/App.tsx
import { useState, useCallback } from "react";
import { Sidebar } from "../src/components/Sidebar";
import { SidebarToggle } from "../src/components/SidebarToggle";
import { ChatFeed } from "../src/components/ChatFeed";
import { InputArea } from "../src/components/InputArea";
import { CanvasPanel } from "../src/components/CanvasPanel";
import { useTheme } from "../src/hooks/useTheme";
import { getLabels } from "../src/i18n/labels";
import { api } from "../src/api/client";
import {
  generateId,
  draftToHtml,
  htmlToMarkdown,
  stripHtml,
} from "../src/lib/utils";
import type { Project, ChatMessage, AppMode, Labels } from "../src/types";
import "./styles/main.css";

function App() {
  const { theme, toggleTheme } = useTheme();
  const [language, setLanguage] = useState("pl");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ragLoadingId, setRagLoadingId] = useState<string | null>(null);

  const [canvasContent, setCanvasContent] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [chartPaths, setChartPaths] = useState<string[]>([]);

  const labels = getLabels(language);
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p,
      ),
    );
  }, []);

  const handleNewProject = useCallback(() => {
    const id = generateId("p");
    setProjects((prev) => [
      {
        id,
        name: `Projekt ${prev.length + 1}`,
        mode: "chatbot" as AppMode,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
        ragEnabled: false,
      },
      ...prev,
    ]);
    setActiveProjectId(id);
    setIsCanvasOpen(false);
    setCanvasContent("");
    setExportMessage("");
    setChartPaths([]);
  }, []);

  const handleSelectProject = useCallback(
    (id: string) => {
      setActiveProjectId(id);
      const project = projects.find((p) => p.id === id);
      if (project?.canvasContent) {
        setCanvasContent(project.canvasContent);
        setChartPaths(project.chartPaths || []);
      } else {
        setCanvasContent("");
        setChartPaths([]);
        setIsCanvasOpen(false);
      }
      setExportMessage("");
    },
    [projects],
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId(null);
        setCanvasContent("");
        setIsCanvasOpen(false);
      }
    },
    [activeProjectId],
  );

  const handleRenameProject = useCallback(
    (id: string, name: string) => updateProject(id, { name }),
    [updateProject],
  );

  const handleArchiveProject = useCallback(
    (id: string) => {
      const p = projects.find((pr) => pr.id === id);
      if (p) updateProject(id, { archived: !p.archived });
    },
    [projects, updateProject],
  );

  const handleToggleRag = useCallback(
    async (id: string) => {
      const p = projects.find((pr) => pr.id === id);
      if (!p) return;
      setRagLoadingId(id);
      try {
        if (p.ragEnabled) {
          await api.disconnectRag(id);
          updateProject(id, { ragEnabled: false, ragContextId: undefined });
        } else {
          const result = await api.connectRag({
            project_id: id,
            collection_name: p.name.replace(/\s+/g, "_").toLowerCase(),
          });
          updateProject(id, {
            ragEnabled: true,
            ragContextId: result.context_id,
          });
        }
      } catch (err) {
        console.error("RAG toggle failed:", err);
      } finally {
        setRagLoadingId(null);
      }
    },
    [projects, updateProject],
  );

  const handleModeChange = useCallback(
    (mode: AppMode) => {
      if (!activeProject) {
        const nameMap: Record<AppMode, string> = {
          chatbot: "Chat",
          gonogo: "Go/No-Go",
          translator: "Tłumaczenie",
          analysis: "Analiza",
        };
        const id = generateId("p");
        setProjects((prev) => [
          {
            id,
            name: `${nameMap[mode]} ${prev.length + 1}`,
            mode,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            archived: false,
            ragEnabled: false,
          },
          ...prev,
        ]);
        setActiveProjectId(id);
      } else {
        updateProject(activeProject.id, { mode });
      }
    },
    [activeProject, updateProject],
  );

  const handleSend = useCallback(
    async (message: string, files: File[]) => {
      let projectId = activeProjectId;
      const currentMode = activeProject?.mode || "chatbot";

      if (!projectId) {
        const id = generateId("p");
        setProjects((prev) => [
          {
            id,
            name: message.slice(0, 40) || `Projekt ${prev.length + 1}`,
            mode: currentMode,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            archived: false,
            ragEnabled: false,
          },
          ...prev,
        ]);
        setActiveProjectId(id);
        projectId = id;
      }

      const userMsg: ChatMessage = {
        id: generateId("c"),
        role: "user",
        content: message || `[${files.length} plik(ów)]`,
        timestamp: new Date(),
        mode: currentMode,
      };

      const currentMsgs =
        projects.find((p) => p.id === projectId)?.messages || [];

      const updates: Partial<Project> = {
        messages: [...currentMsgs, userMsg],
      };

      if (currentMsgs.length === 0 && message.trim() !== "") {
        updates.name = message.slice(0, 40);
      }

      updateProject(projectId, updates);

      setIsLoading(true);

      try {
        const response = await api.sendMessage({
          chat_id: projectId, // TODO: for now projectId is the ID of the new chat
          project_id: undefined,
          mode: currentMode,
          message,
          language,
          canvas_content: isCanvasOpen ? canvasContent : undefined,
          files: files.length > 0 ? files : undefined,
        });

        const assistantMsg: ChatMessage = {
          id: generateId("c"),
          role: "assistant",
          content: response.message,
          timestamp: new Date(),
          mode: currentMode,
          draftData: response.draft_data,
          chartPaths: response.chart_paths,
        };

        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const msgs = [...p.messages, assistantMsg];
            const upd: Partial<Project> = {
              messages: msgs,
              updatedAt: new Date(),
            };
            if (response.draft_data) {
              const html = draftToHtml(response.draft_data, language === "pl");
              upd.canvasContent = html;
              upd.draft = response.draft_data;
              upd.chartPaths = response.chart_paths || [];
              setCanvasContent(html);
              setChartPaths(response.chart_paths || []);
              setIsCanvasOpen(true);
            }
            if (response.canvas_html) {
              upd.canvasContent = response.canvas_html;
              setCanvasContent(response.canvas_html);
            }
            return { ...p, ...upd };
          }),
        );
      } catch (error) {
        console.error("API error:", error);
        const errMsg: ChatMessage = {
          id: generateId("c"),
          role: "assistant",
          content: labels.errorAi,
          timestamp: new Date(),
          mode: currentMode,
        };
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  messages: [...p.messages, errMsg],
                  updatedAt: new Date(),
                }
              : p,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeProjectId,
      activeProject,
      language,
      canvasContent,
      isCanvasOpen,
      labels.errorAi,
      updateProject,
      projects,
    ],
  );

  const handleCanvasChange = useCallback(
    (c: string) => {
      setCanvasContent(c);
      if (activeProjectId) updateProject(activeProjectId, { canvasContent: c });
    },
    [activeProjectId, updateProject],
  );

  const handleExport = useCallback(
    async (format: "pdf" | "docx" | "md") => {
      setExportMessage(labels.generatingFile);
      try {
        const text =
          format === "md"
            ? htmlToMarkdown(canvasContent)
            : stripHtml(canvasContent);
        const result = await api.exportReport({
          project_name: activeProject?.name || "Report",
          edited_text: text,
          format,
          language,
          author: "User",
          chart_paths: chartPaths,
        });
        setExportMessage(`${labels.successFile} ${result.filepath}`);
      } catch {
        setExportMessage(labels.errorExport);
      }
    },
    [canvasContent, activeProject, language, chartPaths, labels],
  );

  const getModeBadge = (mode: AppMode) => {
    const map: Record<
      AppMode,
      { label: keyof Labels; bg: string; color: string }
    > = {
      chatbot: {
        label: "modeChatbot",
        bg: "rgba(59,130,246,0.08)",
        color: "#3b82f6",
      },
      gonogo: {
        label: "modeGoNogo",
        bg: "rgba(227,0,15,0.06)",
        color: "#e3000f",
      },
      translator: {
        label: "modeTranslator",
        bg: "rgba(22,163,74,0.06)",
        color: "#16a34a",
      },
      analysis: {
        label: "modeAnalysis",
        bg: "rgba(217,119,6,0.06)",
        color: "#d97706",
      },
    };
    const m = map[mode];
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          backgroundColor: m.bg,
          color: m.color,
        }}
      >
        {labels[m.label]}
      </span>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "var(--color-bg)",
      }}
    >
      {/* ─── Sidebar ─── */}
      <div
        style={{
          width: isSidebarOpen ? 288 : 0,
          flexShrink: 0,
          height: "100%",
          overflow: "hidden",
          transition: "width 0.3s ease",
        }}
      >
        <Sidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onNewProject={handleNewProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={handleRenameProject}
          onArchiveProject={handleArchiveProject}
          onToggleRag={handleToggleRag}
          ragLoadingId={ragLoadingId}
          labels={labels}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </div>

      {/* ─── Main area ─── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          minWidth: 0,
          height: "100%",
        }}
      >
        {/* Toggle sticks to left edge of main area */}
        <SidebarToggle
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* ─── Chat column ─── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: isCanvasOpen ? "50%" : "100%",
            minWidth: 0,
            height: "100%",
            transition: "width 0.3s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              padding: "16px 32px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                minWidth: 0,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--color-text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {activeProject?.name || labels.headerTitle}
              </h2>
              {activeProject && getModeBadge(activeProject.mode)}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <button
                onClick={() =>
                  setLanguage((prev) => (prev === "pl" ? "en" : "pl"))
                }
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-surface-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-surface)";
                }}
              >
                {language.toUpperCase()}
              </button>

              {canvasContent && (
                <button
                  onClick={() => setIsCanvasOpen((prev) => !prev)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: 8,
                    border: isCanvasOpen
                      ? "1px solid #e3000f"
                      : "1px solid var(--color-border)",
                    backgroundColor: isCanvasOpen
                      ? "#e3000f"
                      : "var(--color-surface)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: isCanvasOpen
                      ? "#fff"
                      : "var(--color-text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (!isCanvasOpen) {
                      e.currentTarget.style.borderColor = "rgba(227,0,15,0.4)";
                      e.currentTarget.style.color = "#e3000f";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCanvasOpen) {
                      e.currentTarget.style.borderColor = "var(--color-border)";
                      e.currentTarget.style.color =
                        "var(--color-text-secondary)";
                    }
                  }}
                >
                  {isCanvasOpen ? labels.closeCanvas : labels.openCanvas}
                </button>
              )}
            </div>
          </div>

          {/* Chat feed — takes all remaining vertical space */}
          <ChatFeed
            messages={activeProject?.messages || []}
            isLoading={isLoading}
            onOpenCanvas={() => setIsCanvasOpen(true)}
            labels={labels}
          />

          {/* Input — pinned at bottom */}
          <InputArea
            mode={activeProject?.mode || "chatbot"}
            onModeChange={handleModeChange}
            onSend={handleSend}
            isLoading={isLoading}
            labels={labels}
          />
        </div>

        {/* ─── Canvas ─── */}
        <div
          style={{
            width: isCanvasOpen ? "50%" : 0,
            height: "100%",
            overflow: "hidden",
            transition: "width 0.3s ease",
          }}
        >
          <CanvasPanel
            isOpen={isCanvasOpen}
            content={canvasContent}
            onChange={handleCanvasChange}
            onClose={() => setIsCanvasOpen(false)}
            onExport={handleExport}
            exportMessage={exportMessage}
            labels={labels}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
