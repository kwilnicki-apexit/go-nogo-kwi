// ============================================================
// FILE: .\frontend\src\components\SettingsPanel.tsx
// ============================================================

import { useRef, useEffect } from "react";
import { X, Globe } from "lucide-react";
import type { Labels, UserConfig, LangCode } from "../types";
import { getInitials } from "../lib/utils";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userConfig: UserConfig;
  onUpdateConfig: (updates: Partial<UserConfig>) => void;
  language: LangCode;
  onSetLanguage: (lang: LangCode) => void;
  labels: Labels;
}

export const SettingsPanel = ({
  isOpen,
  onClose,
  userConfig,
  onUpdateConfig,
  language,
  onSetLanguage,
  labels,
}: SettingsPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(
      () => document.addEventListener("mousedown", handler),
      50,
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const initials = getInitials(userConfig.displayName);

  return (
    <div
      ref={panelRef}
      className="animate-fade-in-up"
      style={{
        position: "absolute",
        bottom: 60,
        left: 8,
        right: 8,
        zIndex: 100,
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface-secondary)",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-text-primary)",
          }}
        >
          {labels.userSettings}
        </span>
        <button
          onClick={onClose}
          style={{
            padding: 4,
            borderRadius: 6,
            color: "var(--color-text-tertiary)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--color-surface-tertiary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          title={labels.closeSettings}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Avatar preview */}
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
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#1d4ed8",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userConfig.displayName}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              {userConfig.role}
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              marginBottom: 4,
              letterSpacing: "0.03em",
            }}
          >
            {labels.displayNameLabel}
          </label>
          <input
            type="text"
            value={userConfig.displayName}
            onChange={(e) => onUpdateConfig({ displayName: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface-secondary)",
              fontSize: 13,
              color: "var(--color-text-primary)",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-orlen)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          />
        </div>

        {/* Role */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              marginBottom: 4,
              letterSpacing: "0.03em",
            }}
          >
            {labels.roleLabel}
          </label>
          <input
            type="text"
            value={userConfig.role}
            onChange={(e) => onUpdateConfig({ role: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface-secondary)",
              fontSize: 13,
              color: "var(--color-text-primary)",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-orlen)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          />
        </div>

        {/* Author Name (for exports) */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              marginBottom: 4,
              letterSpacing: "0.03em",
            }}
          >
            {labels.authorNameLabel}
          </label>
          <input
            type="text"
            value={userConfig.authorName}
            onChange={(e) => onUpdateConfig({ authorName: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface-secondary)",
              fontSize: 13,
              color: "var(--color-text-primary)",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-orlen)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          />
          <span
            style={{
              display: "block",
              fontSize: 10,
              color: "var(--color-text-muted)",
              marginTop: 3,
            }}
          >
            {labels.authorNameHint}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            backgroundColor: "var(--color-border)",
            margin: "2px 0",
          }}
        />

        {/* Language Selection */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              marginBottom: 6,
              letterSpacing: "0.03em",
            }}
          >
            <Globe size={12} />
            {labels.languageLabel}
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => onSetLanguage("pl")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                border:
                  language === "pl"
                    ? "1.5px solid var(--color-orlen)"
                    : "1px solid var(--color-border)",
                backgroundColor:
                  language === "pl"
                    ? "rgba(227,0,15,0.06)"
                    : "var(--color-surface-secondary)",
                color:
                  language === "pl"
                    ? "var(--color-orlen)"
                    : "var(--color-text-secondary)",
              }}
            >
              🇵🇱 {labels.polish}
            </button>
            <button
              onClick={() => onSetLanguage("en")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                border:
                  language === "en"
                    ? "1.5px solid var(--color-orlen)"
                    : "1px solid var(--color-border)",
                backgroundColor:
                  language === "en"
                    ? "rgba(227,0,15,0.06)"
                    : "var(--color-surface-secondary)",
                color:
                  language === "en"
                    ? "var(--color-orlen)"
                    : "var(--color-text-secondary)",
              }}
            >
              🇬🇧 {labels.english}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
