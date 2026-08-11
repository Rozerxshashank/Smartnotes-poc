import { create } from 'zustand';

interface BackendState {
  ollamaStatus: 'unknown' | 'running' | 'stopped' | 'error';
  isIndexing: boolean;
  indexingNoteId: string | null;
  checkOllamaStatus: (ipcToken: string) => Promise<void>;
  pollIndexingStatus: (ipcToken: string) => Promise<void>;
}

const BACKEND_URL = 'http://127.0.0.1:8765/api';

export const useBackendStore = create<BackendState>((set) => ({
  ollamaStatus: 'unknown',
  isIndexing: false,
  indexingNoteId: null,

  checkOllamaStatus: async (ipcToken: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/../health`, {
        headers: { 'X-IPC-Token': ipcToken }
      });
      if (res.ok) {
        set({ ollamaStatus: 'running' });
      } else {
        set({ ollamaStatus: 'error' });
      }
    } catch {
      set({ ollamaStatus: 'stopped' });
    }
  },

  pollIndexingStatus: async (ipcToken: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/indexing/status`, {
        headers: { 'X-IPC-Token': ipcToken }
      });
      if (res.ok) {
        const data = await res.json();
        set({
          isIndexing: data.is_indexing,
          indexingNoteId: data.current_note_id
        });
      }
    } catch {
      // Silently fail
    }
  }
}));
