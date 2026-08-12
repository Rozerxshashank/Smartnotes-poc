import React, { useEffect } from 'react';
import { useNotesStore } from './store/notesStore';
import { useBackendStore } from './store/backendStore';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { ContextPanel } from './components/ContextPanel';
import { SearchPanel } from './components/SearchPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { GitSync } from './components/GitSync';
import { ConflictModal } from './components/ConflictModal';

declare global {
  interface Window {
    smartnotes: {
      getIpcToken: () => Promise<string>;
      setDirty: (noteId: string, isDirty: boolean) => void;
      onFileConflict: (callback: (noteId: string) => void) => void;
      onSyncRefresh: (callback: () => void) => void;
    };
  }
}

const App: React.FC = () => {
  const setIpcToken = useNotesStore((state) => state.setIpcToken);
  const fetchNotes = useNotesStore((state) => state.fetchNotes);
  const ipcToken = useNotesStore((state) => state.ipcToken);
  const notes = useNotesStore((state) => state.notes);

  const [showSearch, setShowSearch] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showGit, setShowGit] = React.useState(false);
  const [conflictNoteId, setConflictNoteId] = React.useState<string | null>(null);
  const [contextWidth, setContextWidth] = React.useState(320);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(s => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(s => !s);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const checkOllamaStatus = useBackendStore((state) => state.checkOllamaStatus);
  const pollIndexingStatus = useBackendStore((state) => state.pollIndexingStatus);

  useEffect(() => {
    async function init() {
      if (window.smartnotes) {
        const token = await window.smartnotes.getIpcToken();
        setIpcToken(token);
        
        // Initial checks
        checkOllamaStatus(token);
        pollIndexingStatus(token);
        
        // Listen for file conflicts
        window.smartnotes.onFileConflict((noteId) => {
          setConflictNoteId(noteId);
        });

        // Listen for external sync events to refresh UI
        window.smartnotes.onSyncRefresh(() => {
          useNotesStore.getState().fetchNotes();
        });
        
        // Setup polling
        const ollamaInterval = setInterval(() => checkOllamaStatus(token), 30000);
        const indexingInterval = setInterval(() => pollIndexingStatus(token), 2000);
        
        return () => {
          clearInterval(ollamaInterval);
          clearInterval(indexingInterval);
        };
      }
    }
    init();
  }, [setIpcToken, checkOllamaStatus, pollIndexingStatus]);

  useEffect(() => {
    if (ipcToken) {
      fetchNotes();
    }
  }, [ipcToken, fetchNotes]);

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw', 
      overflow: 'hidden',
      backgroundColor: 'var(--color-bg-main)'
    }}>
      {/* Pane 1: Sidebar */}
      <Sidebar 
        onOpenSettings={() => setShowSettings(true)} 
        onOpenGit={() => setShowGit(true)} 
        onOpenSearch={() => setShowSearch(true)} 
      />

      {/* Pane 2: Editor */}
      <div style={{ flex: 1, position: 'relative', minWidth: '300px' }}>
        <Editor />
      </div>

      {/* Resizer Handle */}
      <div 
        style={{ 
          width: '6px', 
          cursor: 'col-resize', 
          backgroundColor: 'transparent', 
          zIndex: 100,
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = contextWidth;
          const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth - (moveEvent.clientX - startX);
            setContextWidth(Math.max(250, Math.min(800, newWidth)));
          };
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
      />

      {/* Pane 3: Context Panel */}
      <ContextPanel width={contextWidth} />

      {/* Modals */}
      {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showGit && <GitSync onClose={() => setShowGit(false)} />}
      {conflictNoteId && (
        <ConflictModal
          noteTitle={notes.find(n => n.id === conflictNoteId)?.title || 'Untitled'}
          onKeepMine={() => {
            // Force a save from the current editor state to overwrite file
            const editorState = useNotesStore.getState().notes.find(n => n.id === conflictNoteId);
            if (editorState) {
               // Make sure activeNoteId is set before updating
               useNotesStore.getState().setActiveNote(conflictNoteId);
               useNotesStore.getState().updateActiveNote(editorState.title, editorState.content);
            }
            setConflictNoteId(null);
          }}
          onUseFile={() => {
            // Reload from DB
            useNotesStore.getState().fetchNotes();
            setConflictNoteId(null);
          }}
          onDismiss={() => setConflictNoteId(null)}
        />
      )}
    </div>
  );
};

export default App;
