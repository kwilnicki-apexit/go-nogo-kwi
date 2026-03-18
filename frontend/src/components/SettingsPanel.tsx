// ============================================================
// FILE: .\frontend\src\components\SettingsPanel.tsx
// ============================================================

import { useEffect } from "react";
import { X, Globe, Server, ShieldAlert, KeyRound } from "lucide-react";
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
  const t = (pl: string, en: string) => (language === "pl" ? pl : en);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: 580,
          backgroundColor: "var(--color-surface)",
          borderRadius: 16,
          border: "1px solid var(--color-border)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()} // Zapobiega zamknięciu przy kliknięciu w okno
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface-secondary)",
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            {labels.userSettings}
          </span>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 8,
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              transition: "all 0.15s",
              border: "none",
              background: "transparent",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          className="custom-scrollbar"
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxHeight: "75vh",
            overflowY: "auto",
          }}
        >
          {/* Avatar & Display Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 700,
                color: "#1d4ed8",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                {labels.displayNameLabel}
              </label>
              <input
                type="text"
                value={userConfig.displayName}
                onChange={(e) =>
                  onUpdateConfig({ displayName: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-secondary)",
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            {/* Role */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  marginBottom: 6,
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
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-secondary)",
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />
            </div>

            {/* Author Name */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  marginBottom: 6,
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
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-secondary)",
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: "var(--color-border)" }} />

          {/* Active Directory / LDAP Integrations (MOCKS) */}
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
                marginBottom: 12,
              }}
            >
              <Server size={13} />{" "}
              {t("Katalog LDAP (Mock)", "LDAP Directory (Mock)")}
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  {t("Nazwa użytkownika LDAP", "LDAP Username")}
                </span>
                <input
                  disabled
                  value="jdeveloper_adm"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px dashed var(--color-border-strong)",
                    backgroundColor: "var(--color-bg)",
                    fontSize: 13,
                    color: "var(--color-text-tertiary)",
                    outline: "none",
                    cursor: "not-allowed",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    cursor: "not-allowed",
                    opacity: 0.7,
                  }}
                  disabled
                >
                  <ShieldAlert size={15} />{" "}
                  {t("Zsynchronizuj z AD", "Sync with AD")}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px",
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  backgroundColor: "#fef2f2",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#dc2626",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onClick={() =>
                  alert(
                    t(
                      "Opcja dostępna tylko dla administratorów domeny.",
                      "Option available only for domain administrators.",
                    ),
                  )
                }
              >
                <KeyRound size={15} />{" "}
                {t(
                  "Wymuś zmianę hasła przy następnym logowaniu",
                  "Force password reset on next login",
                )}
              </button>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: "var(--color-border)" }} />

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
                marginBottom: 8,
              }}
            >
              <Globe size={13} /> {labels.languageLabel}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => onSetLanguage("pl")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
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
                  transition: "all 0.15s",
                }}
              >
                🇵🇱 {labels.polish}
              </button>
              <button
                onClick={() => onSetLanguage("en")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
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
                  transition: "all 0.15s",
                }}
              >
                🇬🇧 {labels.english}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
