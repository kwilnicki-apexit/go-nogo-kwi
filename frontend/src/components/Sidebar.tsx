// ============================================================
// FILE: .\frontend\src\components\Sidebar.tsx
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Search,
  FolderClosed,
  Bot,
  Settings,
  Sun,
  Moon,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import type {
  Project,
  Chat,
  Labels,
  ThemeMode,
  UserConfig,
  LangCode,
} from "../types";
import { cn, getInitials } from "../lib/utils";
import { ProjectContextMenu } from "./ProjectContextMenu";

interface SidebarProps {
  projects: Project[];
  chats: Chat[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewProject: () => void;
  onNewChat: () => void;
  onDeleteProject: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onToggleArchiveProject: (id: string) => void;
  labels: Labels;
  theme: ThemeMode;
  onToggleTheme: () => void;
  userConfig: UserConfig;
  onUpdateUserConfig: (updates: Partial<UserConfig>) => void;
  language: LangCode;
  onSetLanguage: (lang: LangCode) => void;
  onToggleLanguage: () => void;
  onOpenSettings: () => void;
}

export const Sidebar = ({
  projects,
  chats,
  activeId,
  onSelect,
  onNewProject,
  onNewChat,
  onDeleteProject,
  onDeleteChat,
  onRenameProject,
  onToggleArchiveProject,
  labels,
  theme,
  onToggleTheme,
  userConfig,
  onToggleLanguage,
  onOpenSettings,
}: SidebarProps) => {
  const [search, setSearch] = useState("");

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ id: projectId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const startRename = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id);
      if (project) {
        setRenamingId(id);
        setRenameValue(project.name);
      }
    },
    [projects],
  );

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameProject(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  }, [renamingId, renameValue, onRenameProject]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue("");
  }, []);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredChats = chats.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Separate active and archived projects
  const activeProjects = filteredProjects.filter((p) => !p.archived);
  const archivedProjects = filteredProjects.filter((p) => p.archived);

  const initials = getInitials(userConfig.displayName);

  return (
    <div
      className="sidebar-root flex h-full w-full flex-col transition-colors duration-200"
      style={{ position: "relative" }}
    >
      {/* Header */}
      <div className="sidebar-header flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="sidebar-logo-icon flex h-8 w-8 items-center justify-center rounded-md shadow-sm">
          <MessageSquare size={16} className="text-white" />
        </div>
        <span className="text-sm font-bold text-text-primary tracking-wide">
          QA Assistant
        </span>
      </div>

      {/* Action buttons */}
      <div className="p-4 flex gap-2">
        <button
          onClick={onNewChat}
          className="sidebar-new-btn flex-1 flex items-center justify-center gap-2 rounded-md bg-surface px-2 py-2 text-xs font-semibold text-text-primary border border-border shadow-sm hover:bg-surface-tertiary"
        >
          <MessageSquare size={14} /> {labels.newChat}
        </button>
        <button
          onClick={onNewProject}
          className="sidebar-new-btn flex-1 flex items-center justify-center gap-2 rounded-md bg-surface px-2 py-2 text-xs font-semibold text-text-primary border border-border shadow-sm hover:bg-surface-tertiary"
        >
          <FolderClosed size={14} /> {labels.newProject}
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="sidebar-search relative rounded-md border border-border bg-surface">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={labels.searchProjects}
            className="w-full rounded-md bg-transparent py-1.5 pl-9 pr-3 text-xs text-text-primary outline-none"
          />
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {/* Active Projects */}
        <div className="mb-4">
          <div className="px-5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-text-tertiary">
            {labels.projectsSection}
          </div>
          {activeProjects.map((p) => (
            <div
              key={p.id}
              className={cn(
                "group flex items-center justify-between mx-2 mb-1 px-3 py-2 rounded-md cursor-pointer transition-colors",
                activeId === p.id
                  ? "bg-surface-tertiary text-text-primary"
                  : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
              )}
              onClick={() => onSelect(p.id)}
              onContextMenu={(e) => handleContextMenu(e, p.id)}
            >
              <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                <FolderClosed size={14} className="text-orlen shrink-0" />
                {renamingId === p.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") cancelRename();
                    }}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-surface border border-orlen rounded px-1.5 py-0.5 text-sm text-text-primary outline-none"
                  />
                ) : (
                  <span className="truncate text-sm">{p.name}</span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCtxMenu({ id: p.id, x: e.clientX, y: e.clientY });
                }}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary p-0.5 rounded transition-opacity"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Archived Projects */}
        {archivedProjects.length > 0 && (
          <div className="mb-4">
            <div className="px-5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-text-muted">
              {labels.archived}
            </div>
            {archivedProjects.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "group flex items-center justify-between mx-2 mb-1 px-3 py-2 rounded-md cursor-pointer transition-colors opacity-60",
                  activeId === p.id
                    ? "bg-surface-tertiary text-text-primary"
                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
                )}
                onClick={() => onSelect(p.id)}
                onContextMenu={(e) => handleContextMenu(e, p.id)}
              >
                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                  <FolderClosed
                    size={14}
                    className="text-text-muted shrink-0"
                  />
                  {renamingId === p.id ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      onBlur={commitRename}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 bg-surface border border-orlen rounded px-1.5 py-0.5 text-sm text-text-primary outline-none"
                    />
                  ) : (
                    <span className="truncate text-sm">{p.name}</span>
                  )}
                  <span className="text-[9px] font-bold uppercase text-text-muted bg-surface-tertiary px-1.5 py-0.5 rounded shrink-0">
                    {labels.archivedBadge}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCtxMenu({ id: p.id, x: e.clientX, y: e.clientY });
                  }}
                  className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary p-0.5 rounded transition-opacity"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chats */}
        <div className="mb-4">
          <div className="px-5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-text-tertiary">
            {labels.recentChatsSection}
          </div>
          {filteredChats.map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center justify-between mx-2 mb-1 px-3 py-2 rounded-md cursor-pointer transition-colors group",
                activeId === c.id
                  ? "bg-surface-tertiary text-text-primary"
                  : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
              )}
              onClick={() => onSelect(c.id)}
            >
              <div className="flex items-center gap-2 truncate">
                <Bot size={14} className="text-blue-500" />
                <span className="truncate text-sm">{c.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer - User & Controls */}
      <div
        className="border-t border-border p-3 flex items-center justify-between bg-surface-secondary"
        style={{ position: "relative" }}
      >
        <div className="flex items-center gap-3 cursor-pointer p-1.5 hover:bg-surface-tertiary rounded-md transition-colors flex-1 min-w-0">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
            style={{
              background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
              color: "#1d4ed8",
            }}
          >
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-text-primary truncate">
              {userConfig.displayName}
            </span>
            <span className="text-[10px] text-text-tertiary truncate">
              {userConfig.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Quick language toggle */}
          <button
            onClick={onToggleLanguage}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary rounded-md transition-colors"
            title={labels.languageLabel}
          >
            {/* <Globe size={15} /> */}
          </button>
          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary rounded-md transition-colors"
            title={labels.changeTheme}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary rounded-md transition-colors"
            title={labels.settings}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Project Context Menu */}
      {ctxMenu && (
        <ProjectContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          isArchived={
            projects.find((p) => p.id === ctxMenu.id)?.archived ?? false
          }
          onClose={() => setCtxMenu(null)}
          onRename={() => startRename(ctxMenu.id)}
          onToggleArchive={() => onToggleArchiveProject(ctxMenu.id)}
          onDelete={() => onDeleteProject(ctxMenu.id)}
          labels={labels}
        />
      )}
    </div>
  );
};
