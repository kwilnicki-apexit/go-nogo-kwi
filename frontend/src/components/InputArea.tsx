// frontend/src/components/InputArea.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Send, Paperclip, X, MessageSquare, FileCheck,
  Languages, BarChart3, FileSpreadsheet, FileIcon,
} from 'lucide-react';
import type { AppMode, AttachedFile, Labels } from '../types';
import { generateId, formatFileSize } from '../lib/utils';

interface InputAreaProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onSend: (message: string, files: File[]) => void;
  isLoading: boolean;
  labels: Labels;
}

const MAX_FILES = 20;

const modes: { key: AppMode; icon: React.ReactNode; labelKey: keyof Labels; color: string; activeBg: string; activeRing: string }[] = [
  { key: 'chatbot', icon: <MessageSquare size={15} />, labelKey: 'modeChatbot', color: '#3b82f6', activeBg: 'rgba(59,130,246,0.08)', activeRing: 'rgba(59,130,246,0.35)' },
  { key: 'gonogo', icon: <FileCheck size={15} />, labelKey: 'modeGoNogo', color: '#e3000f', activeBg: 'rgba(227,0,15,0.06)', activeRing: 'rgba(227,0,15,0.35)' },
  { key: 'translator', icon: <Languages size={15} />, labelKey: 'modeTranslator', color: '#16a34a', activeBg: 'rgba(22,163,74,0.06)', activeRing: 'rgba(22,163,74,0.35)' },
  { key: 'analysis', icon: <BarChart3 size={15} />, labelKey: 'modeAnalysis', color: '#d97706', activeBg: 'rgba(217,119,6,0.06)', activeRing: 'rgba(217,119,6,0.35)' },
];

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') return <FileSpreadsheet size={14} color="#16a34a" />;
  if (ext === 'pdf') return <FileIcon size={14} color="#e3000f" />;
  return <FileIcon size={14} color="var(--color-text-tertiary)" />;
};

export const InputArea = ({ mode, onModeChange, onSend, isLoading, labels }: InputAreaProps) => {
  const [text, setText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => { adjustHeight(); }, [text, adjustHeight]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    onSend(trimmed, attachedFiles.map(af => af.file));
    setText('');
    setAttachedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => { if (textareaRef.current) textareaRef.current.style.height = 'auto'; }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles: AttachedFile[] = Array.from(e.target.files).map(f => ({ file: f, id: generateId() }));
    setAttachedFiles(prev => [...prev, ...newFiles].slice(0, MAX_FILES));
  };

  const removeFile = (id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id));

  const canSend = text.trim() || attachedFiles.length > 0;

  return (
    <div style={{
      borderTop: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-surface)',
      padding: '20px 24px 24px',
      flexShrink: 0,
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* File chips */}
        {attachedFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {attachedFiles.map(af => (
              <div key={af.id} className="animate-fade-in-up" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                borderRadius: 8, border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-secondary)',
                padding: '8px 12px', fontSize: 13,
              }}>
                {getFileIcon(af.file.name)}
                <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {af.file.name}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{formatFileSize(af.file.size)}</span>
                <button onClick={() => removeFile(af.id)} style={{
                  padding: 4, borderRadius: '50%', color: 'var(--color-text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className="input-box-wrapper" style={{
          display: 'flex', alignItems: 'flex-end', gap: 12,
          padding: '12px 16px',
        }}>
          {/* Attach */}
          <button
            className="input-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title={labels.attachFiles}
            style={{ flexShrink: 0 }}
          >
            <Paperclip size={20} />
          </button>
          <input ref={fileInputRef} type="file" multiple accept=".csv,.xls,.xlsx,.pdf,.json,.xml,.txt" onChange={handleFileChange} style={{ display: 'none' }} />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={labels.chatPlaceholder}
            rows={1}
            disabled={isLoading}
            style={{
              flex: 1, resize: 'none', border: 'none', outline: 'none',
              backgroundColor: 'transparent',
              padding: '10px 4px', fontSize: 15, lineHeight: 1.6,
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
              maxHeight: 200,
              opacity: isLoading ? 0.5 : 1,
            }}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
          />

          {/* Send */}
          <button
            className={`input-send-btn ${canSend && !isLoading ? 'enabled' : 'disabled'}`}
            onClick={handleSend}
            disabled={isLoading || !canSend}
            style={{ flexShrink: 0 }}
          >
            <Send size={18} />
          </button>
        </div>

        {/* Mode buttons BELOW */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {modes.map(m => {
              const isActive = mode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => onModeChange(m.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '9px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    backgroundColor: isActive ? m.activeBg : 'transparent',
                    color: isActive ? m.color : 'var(--color-text-secondary)',
                    boxShadow: isActive ? `inset 0 0 0 1.5px ${m.activeRing}` : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-tertiary)';
                      e.currentTarget.style.color = m.color;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  {m.icon}
                  <span>{labels[m.labelKey]}</span>
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Enter ↵ {labels.sendMessage} · Shift+Enter {labels.newLine}
          </span>
        </div>
      </div>
    </div>
  );
};