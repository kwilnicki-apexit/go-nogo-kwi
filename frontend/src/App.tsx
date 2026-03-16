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
import { CheckCircle } from "lucide-react";
import "./styles/main.css";

function App() {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, setLang } = useLanguage();
  const { userConfig, updateUserConfig } = useUserConfig();
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

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: [...c.messages, userMsg],
                updatedAt: new Date(),
              }
            : c,
        ),
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
        });

        const assistantMsg: ChatMessage = {
          id: generateId("m"),
          role: "assistant",
          content: response.message,
          timestamp: new Date(),
          mode: modeToUse,
          draftData: response.draft_data,
          chartPaths: response.chart_paths,
        };

        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== chatId) return c;
            const upd: Partial<Chat> = {
              messages: [...c.messages, assistantMsg],
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
      }
    },
    [projects, chats],
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
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
    async (format: "pdf" | "docx" | "md") => {
      if (!activeChat) return;
      setExportMessage(labels.generatingFile);
      try {
        const text =
          format === "md"
            ? htmlToMarkdown(canvasContent)
            : stripHtml(canvasContent);
        const result = await api.exportReport({
          project_name: activeChat.id,
          edited_text: text,
          format,
          language,
          author: userConfig.authorName,
          chart_paths: chartPaths,
        });
        setExportMessage(`${labels.successFile} ${result.filepath}`);
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
                {activeChat?.projectId && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle size={10} /> {labels.projectContextActive}
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

            <ChatFeed
              messages={activeChat?.messages || []}
              isLoading={isLoading}
              onOpenCanvas={() => setIsCanvasOpen(true)}
              labels={labels}
            />

            <InputArea
              mode={activeChat?.mode || "gonogo"}
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
      </div>
    </div>
  );
}

export default App;
