import React from 'react';
import { useNotesStore } from '../store/notesStore';
import { format } from 'date-fns';
import { Plus, Trash2, Settings, Github, Search, Loader2 } from 'lucide-react';
import { useBackendStore } from '../store/backendStore';

export const Sidebar: React.FC<{
  onOpenSettings?: () => void;
  onOpenGit?: () => void;
  onOpenSearch?: () => void;
}> = ({ onOpenSettings, onOpenGit, onOpenSearch }) => {
  const notes = useNotesStore((state) => state.notes);
  const activeNoteId = useNotesStore((state) => state.activeNoteId);
  const setActiveNote = useNotesStore((state) => state.setActiveNote);
  const createNote = useNotesStore((state) => state.createNote);
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const isIndexing = useBackendStore((state) => state.isIndexing);
  const ollamaStatus = useBackendStore((state) => state.ollamaStatus);

  return (
    <div style={{
      width: '260px',
      height: '100%',
      backgroundColor: 'var(--color-bg-panel)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 'var(--z-sidebar)'
    }}>
      <div style={{ 
        padding: 'var(--spacing-md)', 
        paddingTop: 'calc(var(--spacing-md) + 24px)', // macOS traffic light safe area
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)'
      }}>
        <h2 style={{ fontSize: 'var(--font-size-h3)', margin: 0 }}>SmartNotes</h2>
        <button 
          onClick={() => createNote()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            padding: '4px'
          }}
          title="New Note (⌘N)"
        >
          <Plus size={18} />
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-sm)' }}>
        {notes.length === 0 ? (
          <div style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-small)' }}>
            No notes found.
          </div>
        ) : (
          notes.map(note => (
            <div 
              key={note.id}
              tabIndex={0}
              onClick={() => setActiveNote(note.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setActiveNote(note.id);
                  e.preventDefault();
                }
              }}
              style={{
                padding: '8px 12px',
                margin: '0 8px 4px 8px',
                borderRadius: '8px',
                backgroundColor: activeNoteId === note.id ? 'var(--color-accent)' : 'transparent',
                color: activeNoteId === note.id ? '#ffffff' : 'var(--color-text-primary)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                transition: 'var(--transition-fast)'
              }}
            >
              <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {note.title || 'Untitled Note'}
              </div>
              <div style={{ 
                fontSize: '11px', 
                opacity: 0.8,
                marginTop: '4px'
              }}>
                {format(new Date(note.updated_at * 1000), 'MMM d, h:mm a')}
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Are you sure you want to delete this note?')) {
                    deleteNote(note.id);
                  }
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: activeNoteId === note.id ? 'rgba(255,255,255,0.8)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  opacity: 0,
                  transition: 'opacity var(--transition-fast)',
                }}
                className="delete-btn"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
      <style>
        {`
          div[style*="cursor: pointer"]:hover .delete-btn {
            opacity: 1 !important;
          }
        `}
      </style>

      {/* Footer / Utility Bar */}
      <div style={{
        padding: 'var(--spacing-sm)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-bg-panel)',
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onOpenSearch} style={footerBtnStyle} title="Search (⌘K)">
            <Search size={16} />
          </button>
          <button onClick={onOpenGit} style={footerBtnStyle} title="GitHub Sync">
            <Github size={16} />
          </button>
          <button onClick={onOpenSettings} style={footerBtnStyle} title="Settings (⌘,)">
            <Settings size={16} />
          </button>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isIndexing && (
            <div title="Indexing..." style={{ color: 'var(--color-accent)' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          <div 
            title={`Ollama: ${ollamaStatus}`}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: ollamaStatus === 'running' ? '#10b981' : 
                               ollamaStatus === 'error' ? '#ef4444' : 
                               'var(--color-text-secondary)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

const footerBtnStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  padding: '6px',
  borderRadius: 'var(--radius-button)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'var(--transition-fast)',
};
