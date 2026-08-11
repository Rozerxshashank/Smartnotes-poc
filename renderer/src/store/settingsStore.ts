import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  aiProvider: 'ollama' | 'openai' | 'mistral' | 'sbert';
  autoLinkThreshold: number;
  notesDir: string;
  openaiKey: string;
  mistralKey: string;
  githubPat: string;
  githubRepo: string;
  setAiProvider: (provider: SettingsState['aiProvider']) => void;
  setAutoLinkThreshold: (threshold: number) => void;
  setNotesDir: (dir: string) => void;
  setOpenaiKey: (key: string) => void;
  setMistralKey: (key: string) => void;
  setGithubPat: (pat: string) => void;
  setGithubRepo: (repo: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiProvider: 'ollama',
      autoLinkThreshold: 0.75,
      notesDir: '',
      openaiKey: '',
      mistralKey: '',
      githubPat: '',
      githubRepo: '',

      setAiProvider: (provider) => set({ aiProvider: provider }),
      setAutoLinkThreshold: (threshold) => set({ autoLinkThreshold: threshold }),
      setNotesDir: (dir) => set({ notesDir: dir }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setMistralKey: (key) => set({ mistralKey: key }),
      setGithubPat: (pat) => set({ githubPat: pat }),
      setGithubRepo: (repo) => set({ githubRepo: repo }),
    }),
    {
      name: 'smartnotes-settings',
    }
  )
);
