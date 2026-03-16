// frontend/src/components/Sidebar.tsx
import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  FileCheck,
  Languages,
  BarChart3,
  Bot,
  Trash2,
  Archive,
  ArchiveRestore,
  Pencil,
  Check,
  X,
  Database,
  Loader2,
  Moon,
  Sun,
  MoreHorizontal,
} from 'lucide-react';
import type { Project, Labels, AppMode, ThemeMode } from '../src/types';
import { cn, isToday, isYesterday } from '../src/lib/utils';

interface SidebarProps{
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onArchiveProject: (id: string) => void;
  onToggleRag: (id: string) => void;
  ragLoadingId: string | null;
  labels: Labels;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const modeIcons: Record<AppMode, React.ReactNode> = {
  chatbot: <Bot size={14} />,
  gonogo: <FileCheck size={14} />,
  translator: <Languages size={14} />,
  analysis: <BarChart3 size={14} />,
};

const modeColors: Record<AppMode, string> = {
  chatbot: 'text-blue-500',
  gonogo: 'text-orlen',
  translator: 'text-green-500',
  analysis: 'text-amber-500',
};

export const Sidebar = ({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onRenameProject,
  onArchiveProject,
  onToggleRag,
  ragLoadingId,
  labels,
  theme,
  onToggleTheme,
}: SidebarProps) => {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  const filterList = (list: Project[]) =>
    list.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));

  const filtered = filterList(showArchived ? archivedProjects : activeProjects);

  const grouped = {
    today: filtered.filter(p => isToday(p.updatedAt)),
    yesterday: filtered.filter(p => isYesterday(p.updatedAt)),
    older: filtered.filter(p => !isToday(p.updatedAt) && !isYesterday(p.updatedAt)),
  };

  const startRename = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
    setMenuOpenId(null);
  };

  const submitRename = () => {
    if (editingId && editName.trim()) onRenameProject(editingId, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      onDeleteProject(id);
      setConfirmDeleteId(null);
      setMenuOpenId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const renderProject = (project: Project) => {
    const isEditing = editingId === project.id;
    const isActive = project.id === activeProjectId;
    const isMenuOpen = menuOpenId === project.id;
    const isRagLoading = ragLoadingId === project.id;

    return (
      <div
        key={project.id}
        className={cn(
          'sidebar-project-item group relative',
          isActive && 'active',
        )}
      >
        {isEditing ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <input
              ref={editInputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') cancelRename();
              }}
              className="flex-1 min-w-0 rounded-md bg-surface px-2 py-1 text-sm text-text-primary outline-none focus:ring-2 focus:ring-orlen/30 border border-border"
              data-gramm="false"
            />
            <button onClick={submitRename} className="shrink-0 rounded p-1 text-green-500 hover:bg-surface">
              <Check size={14} />
            </button>
            <button onClick={cancelRename} className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div
            className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
            onClick={() => onSelectProject(project.id)}
          >
            <span className={cn('shrink-0', modeColors[project.mode])}>
              {modeIcons[project.mode]}
            </span>
            <span className="truncate flex-1 text-sm font-medium">{project.name}</span>

            {project.ragEnabled && (
              <span className="shrink-0" title={labels.ragConnected}>
                {isRagLoading ? (
                  <Loader2 size={12} className="text-amber-500 animate-spin" />
                ) : (
                  <Database size={12} className="text-green-500" />
                )}
              </span>
            )}

            <button
              className={cn('sidebar-more-btn shrink-0 p-1 text-text-tertiary', isMenuOpen && 'visible')}
              onClick={e => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : project.id);
                setConfirmDeleteId(null);
              }}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        )}

        {isMenuOpen && !isEditing && (
          <div
            ref={menuRef}
            className="ctx-menu animate-ctx-menu absolute right-1 top-full z-50 mt-1"
          >
            <button
              onClick={e => { e.stopPropagation(); startRename(project); }}
              className="ctx-menu-item"
            >
              <Pencil size={12} />
              <span>{labels.editName}</span>
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                onToggleRag(project.id);
                setMenuOpenId(null);
              }}
              className="ctx-menu-item"
            >
              <Database size={12} />
              <span>{project.ragEnabled ? labels.ragDisconnect : labels.ragConnect}</span>
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                onArchiveProject(project.id);
                setMenuOpenId(null);
              }}
              className="ctx-menu-item"
            >
              {project.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
              <span>{project.archived ? labels.unarchive : labels.archive}</span>
            </button>
            <div className="ctx-menu-divider" />
            {confirmDeleteId === project.id ? (
              <div className="ctx-menu-delete-confirm">
                <span className="ctx-menu-delete-confirm-text">{labels.confirmDelete}</span>
                <div className="ctx-menu-delete-confirm-actions">
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteProject(project.id); setConfirmDeleteId(null); setMenuOpenId(null); }}
                    className="ctx-menu-delete-yes"
                  >
                    <Trash2 size={11} />
                    <span>{labels.deleteProject}</span>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                    className="ctx-menu-delete-no"
                  >
                    {labels.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); handleDelete(project.id); }}
                className="ctx-menu-item danger"
              >
                <Trash2 size={12} />
                <span>{labels.deleteProject}</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (label: string, items: Project[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-2">
        <div className="flex items-center gap-3 px-5 py-2">
          <div className="sidebar-group-label flex-1" />
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap">
            {label}
          </span>
          <div className="sidebar-group-label flex-1" />
        </div>
        {items.map(renderProject)}
      </div>
    );
  };

  return (
    <div className="sidebar-root flex h-full w-full flex-col transition-colors duration-200">
      {/* Header */}
      <div className="sidebar-header flex items-center gap-3 px-5 py-5">
        <div className="sidebar-logo-icon flex h-8 w-8 items-center justify-center rounded-lg">
          <MessageSquare size={16} className="text-white" />
        </div>
        <span className="text-sm font-bold text-text-primary tracking-wide">QA Assistant</span>
      </div>

      {/* New project */}
      <div className="p-4">
        <button
          onClick={onNewProject}
          className="sidebar-new-btn flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-text-primary"
        >
          <Plus size={16} />
          {labels.newProject}
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="sidebar-search relative rounded-lg">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={labels.searchProjects}
            className="w-full rounded-lg bg-transparent py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted outline-none"
            data-gramm="false"
          />
        </div>
      </div>

      {/* Active / Archived toggle */}
      <div className="flex mx-4 mb-3 p-1 sidebar-tab-group rounded-lg">
        <button
          onClick={() => setShowArchived(false)}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
            !showArchived ? 'sidebar-tab-active text-text-primary' : 'text-text-secondary hover:text-text-primary'
          )}
        >
          {labels.active} ({activeProjects.length})
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
            showArchived ? 'sidebar-tab-active text-text-primary' : 'text-text-secondary hover:text-text-primary'
          )}
        >
          {labels.archived} ({archivedProjects.length})
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm font-medium text-text-tertiary">
            {labels.noProjects}
          </div>
        ) : (
          <>
            {renderGroup(labels.today, grouped.today)}
            {renderGroup(labels.yesterday, grouped.yesterday)}
            {renderGroup(labels.older, grouped.older)}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer p-3">
        <button
          onClick={onToggleTheme}
          className="sidebar-theme-btn flex w-full items-center justify-center gap-2.5 px-3 py-2 text-sm font-semibold text-text-secondary"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? labels.lightMode : labels.darkMode}
        </button>
      </div>
    </div>
  );
};