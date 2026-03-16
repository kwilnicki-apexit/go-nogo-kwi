// frontend/src/components/Sidebar.tsx
import { useState } from "react";
import {
  MessageSquare,
  Search,
  FolderClosed,
  Trash2,
  Bot,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import type { Project, Chat, Labels, ThemeMode } from "../types";
import { cn } from "../lib/utils";

interface SidebarProps {
  projects: Project[];
  chats: Chat[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewProject: () => void;
  onNewChat: () => void;
  onDeleteProject: (id: string) => void;
  onDeleteChat: (id: string) => void;
  labels: Labels;
  theme: ThemeMode;
  onToggleTheme: () => void;
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
  labels,
  theme,
  onToggleTheme,
}: SidebarProps) => {
  const [search, setSearch] = useState("");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredChats = chats.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="sidebar-root flex h-full w-full flex-col transition-colors duration-200">
      {/* Header */}
      <div className="sidebar-header flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orlen shadow-sm">
          <MessageSquare size={16} className="text-white" />
        </div>
        <span className="text-sm font-bold text-text-primary tracking-wide">
          QA Assistant
        </span>
      </div>

      {/* Akcje */}
      <div className="p-4 flex gap-2">
        <button
          onClick={onNewChat}
          className="sidebar-new-btn flex-1 flex items-center justify-center gap-2 rounded-md bg-surface px-2 py-2 text-xs font-semibold text-text-primary border border-border shadow-sm hover:bg-surface-tertiary"
        >
          <MessageSquare size={14} /> Nowy Czat
        </button>
        <button
          onClick={onNewProject}
          className="sidebar-new-btn flex-1 flex items-center justify-center gap-2 rounded-md bg-surface px-2 py-2 text-xs font-semibold text-text-primary border border-border shadow-sm hover:bg-surface-tertiary"
        >
          <FolderClosed size={14} /> Nowy Projekt
        </button>
      </div>

      {/* Szukajka */}
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

      {/* Listy */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {/* PROJEKTY */}
        <div className="mb-4">
          <div className="px-5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-text-tertiary">
            Projekty
          </div>
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex items-center justify-between mx-2 mb-1 px-3 py-2 rounded-md cursor-pointer transition-colors",
                activeId === p.id
                  ? "bg-surface-tertiary text-text-primary"
                  : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
              )}
              onClick={() => onSelect(p.id)}
            >
              <div className="flex items-center gap-2 truncate">
                <FolderClosed size={14} className="text-orlen" />
                <span className="truncate text-sm">{p.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject(p.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* CZATY */}
        <div className="mb-4">
          <div className="px-5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-text-tertiary">
            Ostatnie Czaty
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

      {/* Footer - Użytkownik & Motyw */}
      <div className="border-t border-border p-3 flex items-center justify-between bg-surface-secondary">
        <div className="flex items-center gap-3 cursor-pointer p-1.5 hover:bg-surface-tertiary rounded-md transition-colors flex-1">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
            JD
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-text-primary">Jan Developer</span>
            <span className="text-[10px] text-text-tertiary">QA Engineer</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={onToggleTheme} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary rounded-md transition-colors" title="Zmień motyw">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary rounded-md transition-colors" title="Ustawienia">
            <Settings size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
