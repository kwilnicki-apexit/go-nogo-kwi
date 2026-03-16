// frontend/src/App.tsx

import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { SidebarToggle } from "./components/SidebarToggle";
import { ChatFeed } from "./components/ChatFeed";
import { InputArea } from "./components/InputArea";
import { CanvasPanel } from "./components/CanvasPanel";
import { useTheme } from "./hooks/useTheme";
import { getLabels } from "./i18n/labels";
import { api } from "./api/client";
import {
  generateId,
  draftToHtml,
  htmlToMarkdown,
  stripHtml,
} from "./lib/utils";
import type { Project, Chat, ChatMessage, AppMode } from "./types";
import {
  UploadCloud,
  Save,
  CheckCircle,
  MessageSquare,
  Copy,
  FileText,
  Send,
} from "lucide-react";
import "./styles/main.css";

function App() {
  const { theme, toggleTheme } = useTheme();
  const [language] = useState("pl");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);

  // --- LOCAL STORAGE PERSISTENCE ---
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem("qa-projects");
    if (saved)
      return JSON.parse(saved).map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }));
    return [];
  });

  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem("qa-chats");
    if (saved)
      return JSON.parse(saved).map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
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

  // Stany ekranu Projektu
  const [projInstructions, setProjInstructions] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [quickChatInput, setQuickChatInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const labels = getLabels(language);
  if (!labels.newChat) labels.newChat = "Nowy Czat";

  const activeProject = projects.find((p) => p.id === activeId) || null;
  const activeChat = chats.find((c) => c.id === activeId) || null;

  // --- AKCJE SIDEBARU ---
  const handleNewProject = useCallback(() => {
    const id = generateId("p");
    setProjects((prev) => [
      {
        id,
        name: `Projekt ${prev.length + 1}`,
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
  }, []);

  const handleNewChat = useCallback((forcedProjectId?: string) => {
    const id = generateId("c");
    setChats((prev) => [
      {
        id,
        projectId: forcedProjectId || null,
        name: `Nowy Czat ${prev.length + 1}`,
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
  }, []);

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

  // --- AKCJE PROJEKTU ---
  const handleCopyId = () => {
    if (activeProject) {
      navigator.clipboard.writeText(activeProject.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleProjectNameChange = (newName: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeId ? { ...p, name: newName } : p)),
    );
  };

  const saveProjectInstructions = async () => {
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
      console.error(e);
    }
  };

  // Obsługa Wgrywania plików w Projekcie (w tym Drag & Drop)
  const processFiles = async (files: FileList | File[]) => {
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
    } catch (err) {
      alert("Błąd podczas wgrywania plików.");
    } finally {
      setIsLoading(false);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleQuickChatSubmit = async (
    e?: React.KeyboardEvent | React.MouseEvent,
  ) => {
    if (e && "key" in e && e.key !== "Enter") return;
    if (!activeProject || !quickChatInput.trim()) return;

    // Tworzymy czat i od razu wysyłamy pierwszą wiadomość!
    const chatId = generateId("c");
    const newChat: Chat = {
      id: chatId,
      projectId: activeProject.id,
      name: quickChatInput.slice(0, 30),
      mode: "chatbot",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveId(chatId); // Przełącz na czat
    setQuickChatInput(""); // Wyczyść input

    // Przekazanie do normalnego handlera wysyłania (wymaga poczekania na cykl renderowania, więc wołamy funkcję na sztywno)
    handleSend(quickChatInput.trim(), [], chatId, activeProject.id, "chatbot");
  };

  // --- GŁÓWNA AKCJA WYSYŁANIA (Przebudowana by przyjmować parametry) ---
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
          name: message.slice(0, 30) || "Nowa konwersacja",
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
        content: message || `[Wgrano ${files.length} plików]`,
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
        console.error(error);
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
          author: "Jan Developer",
          chart_paths: chartPaths,
        });
        setExportMessage(`${labels.successFile} ${result.filepath}`);
      } catch {
        setExportMessage(labels.errorExport);
      }
    },
    [canvasContent, activeChat, language, chartPaths, labels],
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
          width: isSidebarOpen ? 288 : 0,
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
          labels={labels}
          theme={theme}
          onToggleTheme={toggleTheme}
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

        {/* =========================================================
            EKRAN PROJEKTU (Nowy Split-Screen)
            ========================================================= */}
        {activeProject && (
          <div className="flex-1 overflow-y-auto bg-surface flex justify-center p-8">
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* LEWA KOLUMNA: Info i Utworzenie Czatu */}
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-bold text-text-primary mb-1">
                    Ustawienia Projektu
                  </h1>
                  <p className="text-text-tertiary text-sm mb-6">
                    Zarządzaj kontekstem i rozpocznij analizę w ramach tego
                    projektu.
                  </p>
                </div>

                <div className="bg-surface-secondary border border-border p-5 rounded-xl shadow-sm">
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">
                    ID Projektu
                  </label>
                  <div className="flex gap-2 mb-4">
                    <input
                      disabled
                      value={activeProject.id}
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-tertiary font-mono"
                    />
                    <button
                      onClick={handleCopyId}
                      className="bg-surface border border-border hover:bg-surface-tertiary text-text-secondary px-3 rounded-lg transition-colors"
                    >
                      {copiedId ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>

                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">
                    Nazwa Projektu
                  </label>
                  <input
                    value={activeProject.name}
                    onChange={(e) => handleProjectNameChange(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-orlen outline-none mb-2"
                  />
                </div>

                <div className="bg-surface-secondary border border-orlen/30 p-5 rounded-xl mt-auto shadow-sm">
                  <h3 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
                    <MessageSquare size={16} className="text-orlen" />{" "}
                    Rozpocznij nowy czat z RAG
                  </h3>
                  <p className="text-xs text-text-tertiary mb-4">
                    Ten czat automatycznie otrzyma dostęp do instrukcji i plików
                    z prawej kolumny.
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={quickChatInput}
                      onChange={(e) => setQuickChatInput(e.target.value)}
                      onKeyDown={handleQuickChatSubmit}
                      placeholder="Napisz pierwszą wiadomość..."
                      className="w-full bg-surface border border-border focus:border-orlen rounded-lg pl-3 pr-10 py-3 text-sm text-text-primary outline-none shadow-sm"
                    />
                    <button
                      onClick={() => handleQuickChatSubmit()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-tertiary hover:text-orlen transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* PRAWA KOLUMNA: Instrukcje i Pliki (RAG) */}
              <div className="flex flex-col gap-6">
                <div className="flex flex-col h-[300px] bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-surface-secondary border-b border-border px-4 py-2.5 flex justify-between items-center">
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">
                      System Prompt (Instrukcje JSON/TXT)
                    </span>
                    <button
                      onClick={saveProjectInstructions}
                      className="flex items-center gap-1.5 text-xs font-bold text-orlen hover:text-orlen-dark transition-colors"
                    >
                      {saveSuccess ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Save size={14} />
                      )}{" "}
                      {saveSuccess ? "Zapisano" : "Zapisz"}
                    </button>
                  </div>
                  <textarea
                    value={projInstructions}
                    onChange={(e) => setProjInstructions(e.target.value)}
                    placeholder="Wpisz wytyczne biznesowe, zasady Go/No-Go..."
                    className="flex-1 w-full bg-transparent p-4 text-sm text-text-primary font-mono outline-none resize-none"
                  />
                </div>

                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`relative flex flex-col border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${isDragging ? "border-orlen bg-orlen/5" : "border-border bg-surface-secondary"}`}
                >
                  {isLoading && (
                    <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm z-10 flex items-center justify-center">
                      <span className="text-sm font-bold animate-pulse text-orlen">
                        Wgrywanie i wektoryzacja...
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">
                        Baza Wiedzy Projektu
                      </h3>
                      <p className="text-xs text-text-tertiary">
                        Przeciągnij i upuść pliki (PDF, DOCX, TXT)
                      </p>
                    </div>
                    <label className="cursor-pointer flex items-center gap-1.5 bg-surface border border-border hover:bg-surface-tertiary px-3 py-1.5 rounded-md text-xs font-bold text-text-secondary transition-colors shadow-sm">
                      <UploadCloud size={14} /> Wgraj
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) =>
                          e.target.files && processFiles(e.target.files)
                        }
                        accept=".pdf,.docx,.txt"
                      />
                    </label>
                  </div>

                  {/* Lista wgranych plików */}
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {!activeProject.uploadedFiles ||
                    activeProject.uploadedFiles.length === 0 ? (
                      <div className="text-center py-6 text-text-muted text-xs">
                        Brak wgranych plików wiedzy.
                      </div>
                    ) : (
                      activeProject.uploadedFiles.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-surface border border-border px-3 py-2 rounded-md text-xs text-text-secondary"
                        >
                          <FileText size={14} className="text-blue-500" />
                          <span className="truncate">{file}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            EKRAN CZATU (Wysuwa się też Canvas)
            ========================================================= */}
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
                  {activeChat?.name || "Nowa Konwersacja"}
                </h2>
                {activeChat?.projectId && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle size={10} /> Kontekst projektu aktywny
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

        {/* CANVAS (Wysuwa się tylko dla czatu) */}
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
