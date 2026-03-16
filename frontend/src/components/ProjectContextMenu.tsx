// ============================================================
// FILE: .\frontend\src\components\ProjectContextMenu.tsx
// ============================================================

import { useState, useRef, useEffect } from "react";
import {
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { Labels } from "../types";

interface ProjectContextMenuProps {
  x: number;
  y: number;
  isArchived: boolean;
  onClose: () => void;
  onRename: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  labels: Labels;
}

export const ProjectContextMenu = ({
  x,
  y,
  isArchived,
  onClose,
  onRename,
  onToggleArchive,
  onDelete,
  labels,
}: ProjectContextMenuProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Clamp menu position to viewport
  const style: React.CSSProperties = {
    position: "fixed",
    top: Math.min(y, window.innerHeight - 200),
    left: Math.min(x, window.innerWidth - 180),
    zIndex: 200,
  };

  return (
    <div ref={menuRef} className="ctx-menu animate-ctx-menu" style={style}>
      {/* Rename */}
      <button
        className="ctx-menu-item"
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        <Pencil size={13} />
        {labels.editName}
      </button>

      {/* Archive / Unarchive */}
      <button
        className="ctx-menu-item"
        onClick={() => {
          onToggleArchive();
          onClose();
        }}
      >
        {isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
        {isArchived ? labels.unarchive : labels.archive}
      </button>

      <hr className="ctx-menu-divider" />

      {/* Delete */}
      {!showDeleteConfirm ? (
        <button
          className="ctx-menu-item danger"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 size={13} />
          {labels.deleteProject}
        </button>
      ) : (
        <div className="ctx-menu-delete-confirm">
          <span className="ctx-menu-delete-confirm-text">
            <AlertTriangle
              size={11}
              style={{
                display: "inline",
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            {labels.confirmDelete}
            <br />
            {labels.confirmDeleteMessage}
          </span>
          <div className="ctx-menu-delete-confirm-actions">
            <button
              className="ctx-menu-delete-yes"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 size={10} />
              {labels.yes}
            </button>
            <button
              className="ctx-menu-delete-no"
              onClick={() => setShowDeleteConfirm(false)}
            >
              {labels.no}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
