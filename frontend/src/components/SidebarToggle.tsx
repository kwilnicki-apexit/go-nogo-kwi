// frontend/src/components/SidebarToggle.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const SidebarToggle = ({ isOpen, onToggle }: SidebarToggleProps) => {
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '72px',
        borderRadius: '0 6px 6px 0',
        border: '1px solid var(--color-border)',
        borderLeft: 'none',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text-tertiary)',
        boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'background-color 0.15s, color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--color-surface-tertiary)';
        e.currentTarget.style.color = 'var(--color-text-secondary)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--color-surface)';
        e.currentTarget.style.color = 'var(--color-text-tertiary)';
      }}
      aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
    >
      {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
    </button>
  );
};