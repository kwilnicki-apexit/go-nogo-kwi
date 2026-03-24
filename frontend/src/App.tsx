// ============================================================
// FILE: .\frontend\src\App.tsx
// ============================================================

import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { SidebarToggle } from "./components/SidebarToggle";
import { ChatFeed } from "./components/ChatFeed";
import { InputArea } from "./components/InputArea";
import { CanvasPanel } from "./components/CanvasPanel";
import { ProjectView } from "./components/ProjectView";
import { SettingsPanel } from "./components/SettingsPanel";
import { useTheme } from "./hooks/useTheme";
import { useLanguage } from "./hooks/useLanguage";
import { useUserConfig } from "./hooks/useUserConfig";
import { getLabels } from "./i18n/labels";
import { api } from "./api/client";
import {
  generateId,
  draftToHtml,
  htmlToMarkdown,
  stripHtml,
} from "./lib/utils";
import type { Project, Chat, ChatMessage, AppMode } from "./types";
import { CheckCircle, Download, FileText, User, X, Lock } from "lucide-react";
import "./styles/main.css";

function App() {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, setLang } = useLanguage();
  const { userConfig, updateUserConfig } = useUserConfig();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);

  // --- LOCAL STORAGE PERSISTENCE ---
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem("qa-projects");
    if (saved)
      return JSON.parse(saved).map((p: Record<string, unknown>) => ({
        ...p,
        createdAt: new Date(p.createdAt as string),
        updatedAt: new Date(p.updatedAt as string),
      }));
    return [];
  });

  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem("qa-chats");
    if (saved)
      return JSON.parse(saved).map((c: Record<string, unknown>) => ({
        ...c,
        createdAt: new Date(c.createdAt as string),
        updatedAt: new Date(c.updatedAt as string),
        messages: (c.messages as Record<string, unknown>[]).map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp as string),
        })),
      }));
    return [];
  });

  useEffect(() => {
    localStorage.setItem("qa-projects", JSON.stringify(projects));
  }, [projects]);
  useEffect(() => {
    localStorage.setItem("qa-chats", JSON.stringify(chats));
  }, [chats]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canvasContent, setCanvasContent] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [chartPaths, setChartPaths] = useState<string[]>([]);

  // Project screen states
  const [projInstructions, setProjInstructions] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const labels = getLabels(language);

  const activeProject = projects.find((p) => p.id === activeId) || null;
  const activeChat = chats.find((c) => c.id === activeId) || null;

  // Chats belonging to the active project
  const projectChats = activeProject
    ? chats.filter((c) => c.projectId === activeProject.id)
    : [];

  // --- MAIN SEND ACTION ---
  const handleSend = useCallback(
    async (
      message: string,
      files: File[],
      forcedChatId?: string,
      forcedProjId?: string | null,
      forcedMode?: AppMode,
    ) => {
      let chatId = forcedChatId || activeId;
      let currentChat = chats.find((c) => c.id === chatId);
      const modeToUse = forcedMode || currentChat?.mode || "chatbot";
      const projIdToUse =
        forcedProjId !== undefined ? forcedProjId : currentChat?.projectId;

      /*
        Only 6 previous messages will be sent to the new context to limit the token count
        TODO: ideally this would need more intelligent pruning (e.g. keep all system and assistant messages, and only trim user messages)
      */
      const recentHistory =
        currentChat?.messages
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content })) || [];

      if (!currentChat && !forcedChatId) {
        chatId = generateId("c");
        const newChat: Chat = {
          id: chatId,
          projectId: null,
          name: message.slice(0, 30) || labels.newConversation,
          mode: modeToUse,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          archived: false,
        };
        setChats((prev) => [newChat, ...prev]);
        currentChat = newChat;
        setActiveId(chatId);
      }

      const userMsg: ChatMessage = {
        id: generateId("m"),
        role: "user",
        content: message || `[${labels.uploadedNFiles} ${files.length}]`,
        timestamp: new Date(),
        mode: modeToUse,
      };

      const fileNames = files.map((f) => f.name);

      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            const newFiles = Array.from(
              new Set([...(c.uploadedFiles || []), ...fileNames]),
            );
            return {
              ...c,
              messages: [...c.messages, userMsg],
              uploadedFiles: newFiles,
              updatedAt: new Date(),
            };
          }
          return c;
        }),
      );

      setIsLoading(true);

      try {
        const response = await api.sendMessage({
          chat_id: chatId!,
          project_id: projIdToUse,
          mode: modeToUse,
          message,
          language,
          canvas_content: isCanvasOpen ? canvasContent : undefined,
          files: files.length > 0 ? files : undefined,
          chat_history: recentHistory,
        });

        const detectedMode = response.detected_mode || modeToUse;

        const assistantMsg: ChatMessage = {
          id: generateId("m"),
          role: "assistant",
          content: response.message,
          timestamp: new Date(),
          mode: detectedMode,
          draftData: response.draft_data,
          chartPaths: response.chart_paths,
        };

        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== chatId) return c;

            const upd: Partial<Chat> = {
              messages: [...c.messages, assistantMsg],
              updatedAt: new Date(),
              mode: detectedMode,
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
            return { ...c, ...upd };
          }),
        );
      } catch (error) {
        console.error("Chat send error:", error);
        const errMsg: ChatMessage = {
          id: generateId("m"),
          role: "assistant",
          content: labels.errorAi,
          timestamp: new Date(),
          mode: modeToUse,
        };
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId ? { ...c, messages: [...c.messages, errMsg] } : c,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeId, chats, language, canvasContent, isCanvasOpen, labels],
  );

  // --- SIDEBAR ACTIONS ---
  const handleNewProject = useCallback(() => {
    const id = generateId("p");
    setProjects((prev) => [
      {
        id,
        name: `${labels.newProject} ${prev.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
        instructions: "",
        uploadedFiles: [],
      },
      ...prev,
    ]);
    setActiveId(id);
    setProjInstructions("");
  }, [labels]);

  const handleNewChat = useCallback(
    (forcedProjectId?: string) => {
      const id = generateId("c");
      setChats((prev) => [
        {
          id,
          projectId: forcedProjectId || null,
          name: `${labels.newChat} ${prev.length + 1}`,
          mode: "chatbot",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          archived: false,
        },
        ...prev,
      ]);
      setActiveId(id);
      setCanvasContent("");
      setIsCanvasOpen(false);
    },
    [labels],
  );

  const handleSelect = useCallback(
    (id: string) => {
      setActiveId(id);
      if (id.startsWith("p-")) {
        const p = projects.find((x) => x.id === id);
        setProjInstructions(p?.instructions || "");
        setIsCanvasOpen(false);
      } else {
        const c = chats.find((x) => x.id === id);
        setCanvasContent(c?.canvasContent || "");
        setChartPaths(c?.chartPaths || []);

        const hasGoNogoHistory = c?.messages.some(
          (m) => m.mode === "gonogo" || !!m.draftData,
        );

        if (c?.mode !== "gonogo" && !hasGoNogoHistory) {
          setIsCanvasOpen(false);
        } else if (c?.canvasContent) {
          setIsCanvasOpen(true);
        }
      }
    },
    [projects, chats],
  );

  /*
    Deleting a project should also delete all its chats (cascading delete), 
    and if the active item is among those deleted, it should reset the active selection and close the canvas.
  */
  const handleDeleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setChats((prev) => prev.filter((c) => c.projectId !== id));

      if (activeId === id) {
        setActiveId(null);
      } else {
        const activeChatObj = chats.find((c) => c.id === activeId);

        if (activeChatObj?.projectId === id) {
          setActiveId(null);
          setIsCanvasOpen(false);
        }
      }
    },
    [activeId, chats],
  );

  const handleDeleteChat = useCallback(
    (id: string) => {
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setIsCanvasOpen(false);
      }
    },
    [activeId],
  );

  const handleRenameProject = useCallback((id: string, newName: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name: newName, updatedAt: new Date() } : p,
      ),
    );
  }, []);

  const handleToggleArchiveProject = useCallback((id: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, archived: !p.archived, updatedAt: new Date() }
          : p,
      ),
    );
  }, []);

  // --- MANAGING FILES IN CHAT ---
  const handleDownloadChatFile = async (filename: string) => {
    if (!activeChat) return;
    try {
      await api.downloadChatFile(activeChat.id, filename);
    } catch (error) {
      console.error("Download failed", error);
      alert(
        language === "pl"
          ? "Nie udało się pobrać pliku."
          : "Failed to download file.",
      );
    }
  };

  const handleDeleteChatFile = async (filename: string) => {
    if (!activeChat) return;
    const confirmMsg =
      language === "pl"
        ? `Czy na pewno chcesz usunąć plik ${filename} z pamięci tego czatu?`
        : `Are you sure you want to delete ${filename} from this chat's memory?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteChatFile(activeChat.id, filename);
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === activeChat.id) {
            return {
              ...c,
              uploadedFiles: c.uploadedFiles?.filter((f) => f !== filename),
            };
          }
          return c;
        }),
      );
    } catch (error) {
      console.error("Delete failed", error);
      alert(
        language === "pl"
          ? "Nie udało się usunąć pliku."
          : "Failed to delete file.",
      );
    }
  };

  // --- PROJECT-VIEW ACTIONS ---
  const handleProjectNameChange = useCallback(
    (newName: string) => {
      if (!activeProject) return;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id ? { ...p, name: newName } : p,
        ),
      );
    },
    [activeProject],
  );

  const saveProjectInstructions = useCallback(async () => {
    if (!activeProject) return;
    try {
      await api.updateProjectInstructions(activeProject.id, projInstructions);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id
            ? { ...p, instructions: projInstructions }
            : p,
        ),
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error("Failed to save project instructions:", e);
    }
  }, [activeProject, projInstructions]);

  const processProjectFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!activeProject || files.length === 0) return;
      try {
        setIsLoading(true);
        const fileArray = Array.from(files);
        await api.uploadProjectFiles(activeProject.id, fileArray);
        const fileNames = fileArray.map((f) => f.name);
        setProjects((prev) =>
          prev.map((p) =>
            p.id === activeProject.id
              ? {
                  ...p,
                  uploadedFiles: [...(p.uploadedFiles || []), ...fileNames],
                }
              : p,
          ),
        );
      } catch {
        alert(labels.uploadError);
      } finally {
        setIsLoading(false);
      }
    },
    [activeProject, labels],
  );

  const handleQuickChatSubmit = useCallback(
    (message: string, mode: AppMode) => {
      if (!activeProject || !message.trim()) return;
      const chatId = generateId("c");
      const newChat: Chat = {
        id: chatId,
        projectId: activeProject.id,
        name: message.slice(0, 30),
        mode,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveId(chatId);
      handleSend(message.trim(), [], chatId, activeProject.id, mode);
    },
    [activeProject, handleSend],
  );

  const handleExport = useCallback(
    async (format: "pdf" | "docx" | "md", addToRag: boolean) => {
      if (!activeChat) return;
      setExportMessage(labels.generatingFile);
      try {
        const text =
          format === "md"
            ? htmlToMarkdown(canvasContent)
            : stripHtml(canvasContent);

        await api.exportReport({
          project_name: activeChat.id,
          edited_text: text,
          format,
          language,
          author: userConfig.authorName,
          chart_paths: chartPaths,
          add_to_rag: addToRag,
        });

        setExportMessage(labels.successFile);
      } catch {
        setExportMessage(labels.errorExport);
      }
    },
    [
      canvasContent,
      activeChat,
      language,
      chartPaths,
      labels,
      userConfig.authorName,
    ],
  );

  const handleCanvasChange = useCallback(
    (c: string) => {
      setCanvasContent(c);
      if (activeChat)
        setChats((prev) =>
          prev.map((ch) =>
            ch.id === activeChat.id ? { ...ch, canvasContent: c } : ch,
          ),
        );
    },
    [activeChat],
  );

  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <div
          className="animate-fade-in-up"
          style={{
            width: 400,
            backgroundColor: "var(--color-surface)",
            padding: 40,
            borderRadius: 16,
            border: "1px solid var(--color-border)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <div className="sidebar-logo-icon flex h-14 w-14 items-center justify-center rounded-xl shadow-lg">
              <Lock size={28} className="text-white" />
            </div>
          </div>
          <h1
            style={{
              textAlign: "center",
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 8,
              color: "var(--color-text-primary)",
            }}
          >
            Sign In to QA Engine
          </h1>
          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "var(--color-text-tertiary)",
              marginBottom: 32,
            }}
          >
            Use your corporate Active Directory credentials.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: 6,
              }}
            >
              Username (LDAP)
            </label>
            <div style={{ position: "relative" }}>
              <User
                size={16}
                color="var(--color-text-tertiary)"
                style={{ position: "absolute", left: 12, top: 12 }}
              />
              <input
                type="text"
                defaultValue="jdeveloper_adm"
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-secondary)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                color="var(--color-text-tertiary)"
                style={{ position: "absolute", left: 12, top: 12 }}
              />
              <input
                type="password"
                defaultValue="••••••••"
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-secondary)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <button
            onClick={() => setIsAuthenticated(true)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              background: "linear-gradient(135deg, #e3000f 0%, #c5000d 100%)",
              color: "white",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              border: "none",
              boxShadow: "0 4px 12px rgba(227, 0, 15, 0.2)",
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

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
      {/* SIDEBAR */}
      <div
        style={{
          width: isSidebarOpen ? 312 : 0,
          flexShrink: 0,
          height: "100%",
          overflow: "hidden",
          transition: "width 0.3s ease",
        }}
      >
        <Sidebar
          projects={projects}
          chats={chats}
          activeId={activeId}
          onSelect={handleSelect}
          onNewProject={handleNewProject}
          onNewChat={() => handleNewChat()}
          onDeleteProject={handleDeleteProject}
          onDeleteChat={handleDeleteChat}
          onRenameProject={handleRenameProject}
          onToggleArchiveProject={handleToggleArchiveProject}
          labels={labels}
          theme={theme}
          onToggleTheme={toggleTheme}
          userConfig={userConfig}
          onUpdateUserConfig={updateUserConfig}
          language={language}
          onSetLanguage={setLang}
          onToggleLanguage={toggleLanguage}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* MAIN AREA */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          minWidth: 0,
          height: "100%",
        }}
      >
        <SidebarToggle
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* PROJECT SCREEN */}
        {activeProject && (
          <ProjectView
            project={activeProject}
            projectChats={projectChats}
            instructions={projInstructions}
            onInstructionsChange={setProjInstructions}
            onSaveInstructions={saveProjectInstructions}
            saveSuccess={saveSuccess}
            onNameChange={handleProjectNameChange}
            onUploadFiles={processProjectFiles}
            onQuickChat={handleQuickChatSubmit}
            onSelectChat={handleSelect}
            onDeleteChat={handleDeleteChat}
            isLoading={isLoading}
            labels={labels}
          />
        )}

        {/* CHAT SCREEN */}
        {!activeProject && (
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
            {/* CHAT HEADER */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
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
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      margin: 0,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {activeChat?.name || labels.newConversation}
                  </h2>

                  {/* INFO ON PROJECT (per ID) */}
                  {activeChat?.projectId ? (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                      <CheckCircle size={10} />
                      Projekt:{" "}
                      {projects.find((p) => p.id === activeChat.projectId)
                        ?.name || "Nieznany projekt"}
                    </span>
                  ) : (
                    <span className="text-xs text-text-tertiary font-medium flex items-center gap-1 mt-1">
                      Czat wolnostojący (brak projektu)
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {canvasContent && (
                    <button
                      onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                      className="bg-surface border border-border hover:border-orlen text-text-secondary hover:text-orlen px-4 py-1.5 rounded-md text-sm font-semibold transition-colors"
                    >
                      {isCanvasOpen ? labels.closeCanvas : labels.openCanvas}
                    </button>
                  )}
                </div>
              </div>

              {/* LIST OF LOCAL FILES */}
              {activeChat?.uploadedFiles &&
                activeChat.uploadedFiles.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider">
                      {language === "pl"
                        ? "Lokalne pliki czatu:"
                        : "Local chat files:"}
                    </span>
                    {activeChat.uploadedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="group flex items-center gap-1 bg-surface-secondary border border-border pl-2 pr-1 py-1 rounded-md text-[11px] font-medium text-text-secondary shadow-sm transition-colors hover:border-border-strong"
                      >
                        <FileText
                          size={10}
                          className="text-blue-500 shrink-0"
                        />
                        <span
                          className="truncate max-w-37.5 cursor-default"
                          title={file}
                        >
                          {file}
                        </span>

                        <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDownloadChatFile(file)}
                            className="p-1 hover:bg-surface-tertiary rounded text-text-tertiary hover:text-blue-600 transition-colors"
                            title={
                              language === "pl"
                                ? "Pobierz plik"
                                : "Download file"
                            }
                          >
                            <Download size={10} />
                          </button>
                          <button
                            onClick={() => handleDeleteChatFile(file)}
                            className="p-1 hover:bg-surface-tertiary rounded text-text-tertiary hover:text-red-500 transition-colors"
                            title={
                              language === "pl"
                                ? "Usuń plik z czatu"
                                : "Delete file"
                            }
                          >
                            <X size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <ChatFeed
              messages={activeChat?.messages || []}
              isLoading={isLoading}
              onOpenCanvas={() => setIsCanvasOpen(true)}
              labels={labels}
            />

            <InputArea
              mode={activeChat?.mode || "chatbot"}
              onModeChange={(m) => {
                if (activeChat)
                  setChats((prev) =>
                    prev.map((c) =>
                      c.id === activeChat.id ? { ...c, mode: m } : c,
                    ),
                  );
              }}
              onSend={(msg, files) => handleSend(msg, files)}
              isLoading={isLoading}
              labels={labels}
            />
          </div>
        )}

        {/* CANVAS */}
        {!activeProject && (
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
        )}

        {/* GLOBAL SETTINGS MODAL */}
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          userConfig={userConfig}
          onUpdateConfig={updateUserConfig}
          language={language}
          onSetLanguage={setLang}
          labels={labels}
        />
      </div>
    </div>
  );
}

export default App;
