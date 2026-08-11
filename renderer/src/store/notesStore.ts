import { create } from 'zustand';

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  created_at: number;
  updated_at: number;
}

interface NotesState {
  notes: Note[];
  activeNoteId: string | null;
  isLoading: boolean;
  isDirty: boolean;
  ipcToken: string | null;
  fetchNotes: () => Promise<void>;
  createNote: () => Promise<void>;
  updateActiveNote: (title: string, content: string) => Promise<void>;
  setActiveNote: (id: string | null) => void;
  setDirtyState: (dirty: boolean) => void;
  setIpcToken: (token: string) => void;
  deleteNote: (id: string) => Promise<void>;
}

const BACKEND_URL = 'http://127.0.0.1:8765/api/notes';

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  isLoading: false,
  isDirty: false,
  ipcToken: null,

  setIpcToken: (token: string) => set({ ipcToken: token }),

  setDirtyState: (dirty: boolean) => {
    set({ isDirty: dirty });
    const { activeNoteId } = get();
    if (activeNoteId && window.smartnotes?.setDirty) {
      window.smartnotes.setDirty(activeNoteId, dirty);
    }
  },

  setActiveNote: (id: string | null) => {
    const { activeNoteId } = get();
    if (activeNoteId && window.smartnotes?.setDirty) {
      window.smartnotes.setDirty(activeNoteId, false); // Clear dirty on old note
    }
    set({ activeNoteId: id, isDirty: false });
  },

  fetchNotes: async () => {
    const { ipcToken } = get();
    if (!ipcToken) return;

    set({ isLoading: true });
    try {
      const res = await fetch(`${BACKEND_URL}/`, {
        headers: { 'X-IPC-Token': ipcToken }
      });
      if (res.ok) {
        const data = await res.json();
        set({ notes: data, isLoading: false });
      }
    } catch (e) {
      console.error('Failed to fetch notes', e);
      set({ isLoading: false });
    }
  },

  createNote: async () => {
    const { ipcToken, fetchNotes } = get();
    if (!ipcToken) return;

    try {
      const res = await fetch(`${BACKEND_URL}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-IPC-Token': ipcToken
        },
        body: JSON.stringify({ title: 'Untitled Note', content: '' })
      });
      
      if (res.ok) {
        const newNote = await res.json();
        await fetchNotes();
        set({ activeNoteId: newNote.id });
      }
    } catch (e) {
      console.error('Failed to create note', e);
    }
  },

  updateActiveNote: async (title: string, content: string) => {
    const { ipcToken, activeNoteId, notes } = get();
    if (!ipcToken || !activeNoteId) return;

    // Optimistic UI update
    set({
      notes: notes.map((n) => n.id === activeNoteId ? { ...n, title, content } : n)
    });

    try {
      await fetch(`${BACKEND_URL}/${activeNoteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-IPC-Token': ipcToken
        },
        body: JSON.stringify({ title, content })
      });
      set({ isDirty: false });
      if (window.smartnotes?.setDirty) {
        window.smartnotes.setDirty(activeNoteId, false);
      }
    } catch (e) {
      console.error('Failed to update note', e);
    }
  },

  deleteNote: async (id: string) => {
    const { ipcToken, activeNoteId, fetchNotes } = get();
    if (!ipcToken) return;

    try {
      await fetch(`${BACKEND_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'X-IPC-Token': ipcToken }
      });
      if (activeNoteId === id) {
        set({ activeNoteId: null });
      }
      await fetchNotes();
    } catch (e) {
      console.error('Failed to delete note', e);
    }
  }
}));
