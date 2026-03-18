// ============================================================
// FILE: .\frontend\src\components\ChatFeed.tsx
// ============================================================

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Check, Copy, FileText } from "lucide-react";
import type { ChatMessage, Labels } from "../types";
import { formatTime } from "../lib/utils";

interface ChatFeedProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onOpenCanvas: () => void;
  labels: Labels;
}

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock = ({
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div
        style={{
          margin: "16px 0",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--color-surface-tertiary)",
            padding: "6px 16px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            {lang}
          </span>
          <button
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              border: "none",
              background: "none",
            }}
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            {copied ? "Skopiowano" : "Kopiuj"}
          </button>
        </div>
        <pre
          style={{
            margin: 0,
            padding: "16px",
            backgroundColor: "var(--color-surface-secondary)",
            overflowX: "auto",
            fontSize: "13px",
            color: "var(--color-text-primary)",
          }}
        >
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  }
  return (
    <code
      style={{
        backgroundColor: "var(--color-surface-tertiary)",
        padding: "2px 6px",
        borderRadius: "4px",
        fontSize: "13px",
        fontFamily: "monospace",
        color: "var(--color-orlen)",
      }}
      {...props}
    >
      {children}
    </code>
  );
};

export const ChatFeed = ({
  messages,
  isLoading,
  onOpenCanvas,
  labels,
}: ChatFeedProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            marginBottom: 32,
            width: 88,
            height: 88,
            borderRadius: 16,
            background:
              "linear-gradient(135deg, rgba(227,0,15,0.1), rgba(227,0,15,0.04))",
            border: "1px solid rgba(227,0,15,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bot size={44} color="#e3000f" />
        </div>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 8,
            color: "var(--color-text-primary)",
          }}
        >
          {labels.welcome}
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "var(--color-text-tertiary)",
            maxWidth: 480,
            lineHeight: 1.7,
          }}
        >
          {labels.welcomeSub}
        </p>
        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            maxWidth: 420,
            width: "100%",
          }}
        >
          {[
            { icon: "💬", label: labels.modeChatbot, desc: labels.chatbotDesc },
            { icon: "✅", label: labels.modeGoNogo, desc: labels.gonogoDesc },
            {
              icon: "🌐",
              label: labels.modeTranslator,
              desc: labels.translatorDesc,
            },
            {
              icon: "📊",
              label: labels.modeRemedy,
              desc: labels.analysisDesc,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: 20,
                borderRadius: 10,
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                textAlign: "left",
                transition: "box-shadow 0.2s, border-color 0.2s",
                cursor: "default",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-tertiary)",
                  marginTop: 4,
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}
      className="custom-scrollbar"
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-in-up">
            {msg.role === "user" ? (
              <UserBubble message={msg} labels={labels} />
            ) : (
              <AssistantBubble
                message={msg}
                onOpenCanvas={onOpenCanvas}
                labels={labels}
              />
            )}
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              padding: "20px 0",
            }}
            className="animate-fade-in-up"
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                flexShrink: 0,
                backgroundColor: "var(--color-surface-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bot size={18} color="var(--color-text-tertiary)" />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 16,
                backgroundColor: "var(--color-surface-tertiary)",
                padding: "16px 24px",
              }}
            >
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

const UserBubble = ({
  message,
  labels,
}: {
  message: ChatMessage;
  labels: Labels;
}) => (
  <div
    style={{ display: "flex", justifyContent: "flex-end", padding: "12px 0" }}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        maxWidth: "80%",
      }}
    >
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--color-surface-secondary)",
          border: "1px solid var(--color-border)",
          padding: "12px 16px",
          color: "var(--color-text-primary)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            margin: 0,
          }}
        >
          {message.content}
        </p>
      </div>
      <span
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "var(--color-text-muted)",
          fontWeight: 500,
        }}
      >
        {formatTime(message.timestamp)} · {labels.userLabel}
      </span>
    </div>
  </div>
);

const AssistantBubble = ({
  message,
  onOpenCanvas,
  labels,
}: {
  message: ChatMessage;
  onOpenCanvas: () => void;
  labels: Labels;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 16,
      padding: "16px 0",
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--color-orlen)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
      }}
    >
      <Bot size={18} color="#ffffff" />
    </div>
    <div style={{ display: "flex", flexDirection: "column", maxWidth: "85%" }}>
      <div
        style={{
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderLeft: "3px solid var(--color-orlen)",
          padding: "16px 20px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
        }}
      >
        <div
          className="chat-markdown"
          style={{ fontSize: 15, color: "var(--color-text-primary)" }}
        >
          <ReactMarkdown components={{ code: CodeBlock }}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>

      {message.draftData && (
        <button
          onClick={onOpenCanvas}
          style={{
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            alignSelf: "flex-start",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-orlen)",
            backgroundColor: "var(--color-surface)",
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-orlen)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-orlen)";
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-surface)";
            e.currentTarget.style.color = "var(--color-orlen)";
          }}
        >
          <FileText size={15} />
          {labels.openCanvas}
        </button>
      )}

      <span
        style={{
          marginTop: 8,
          fontSize: 11,
          color: "var(--color-text-muted)",
          fontWeight: 500,
        }}
      >
        {formatTime(message.timestamp)} · {labels.systemQaLabel}
      </span>
    </div>
  </div>
);
