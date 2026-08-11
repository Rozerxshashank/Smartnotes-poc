import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConflictModalProps {
  noteTitle: string;
  onKeepMine: () => void;
  onUseFile: () => void;
  onDismiss: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({ noteTitle, onKeepMine, onUseFile, onDismiss }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 'var(--z-modal)',
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-main)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-popover)',
        padding: 'var(--spacing-xl)',
        width: '400px',
        maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-md)' }}>
          <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-h3)' }}>File Conflict</h3>
        </div>
        
        <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
          The file for <strong>"{noteTitle}"</strong> was modified externally while you have unsaved changes.
        </p>
        
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-lg)', justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-button)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small)',
            }}
          >
            Dismiss
          </button>
          <button
            onClick={onUseFile}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-button)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small)',
            }}
          >
            Use File Version
          </button>
          <button
            onClick={onKeepMine}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-button)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small)',
            }}
          >
            Keep Mine
          </button>
        </div>
      </div>
    </div>
  );
};
