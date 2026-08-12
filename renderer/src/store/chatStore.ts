import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettingsStore } from './settingsStore';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { id: string; title: string }[];
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

interface ChatState {
  messages: ChatMessage[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
  activeController: AbortController | null;
  addUserMessage: (content: string) => void;
  startStreaming: (query: string, ipcToken: string) => void;
  stopStreaming: () => void;
  clearChat: () => void;
  saveCurrentSession: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

const BACKEND_URL = 'http://127.0.0.1:8765/api/ask';

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
  sessions: [],
  activeSessionId: null,
  isStreaming: false,
  activeController: null,

  addUserMessage: (content: string) => {
    set((state) => {
      const newMessages = [...state.messages, { role: 'user', content }];
      return { messages: newMessages };
    });
    get().saveCurrentSession();
  },

  startStreaming: (query: string, ipcToken: string) => {
    const { stopStreaming } = get();
    stopStreaming();

    const controller = new AbortController();

    set((state) => ({
      messages: [...state.messages, { role: 'user', content: query }],
      isStreaming: true,
      activeController: controller
    }));

    // Add empty assistant message for streaming
    set((state) => ({
      messages: [...state.messages, { role: 'assistant', content: '', isStreaming: true }]
    }));

    const url = `${BACKEND_URL}/stream`;
    
    const currentMessages = get().messages;
    const historyToSend = currentMessages.slice(0, currentMessages.length - 1).map(m => ({
      role: m.role,
      content: m.content
    }));
    
    // Get the provider and API key from settings
    const settings = useSettingsStore.getState();
    const provider = settings.aiProvider;
    let apiKey = '';
    if (provider === 'gemini') apiKey = settings.geminiKey;
    else if (provider === 'openai') apiKey = settings.openaiKey;
    else if (provider === 'mistral') apiKey = settings.mistralKey;
    
    // Use fetch with ReadableStream for SSE since EventSource doesn't support custom headers or POST bodies
    fetch(url, {
      method: 'POST',
      headers: { 
        'X-IPC-Token': ipcToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        messages: historyToSend,
        provider: provider,
        api_key: apiKey
      }),
      signal: controller.signal
    }).then(async (response) => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) return;
      
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'token') {
                set((state) => {
                  const msgs = [...state.messages];
                  const last = msgs[msgs.length - 1];
                  if (last && last.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, content: last.content + data.content };
                  }
                  return { messages: msgs };
                });
              } else if (data.type === 'done') {
                set((state) => {
                  const msgs = [...state.messages];
                  const last = msgs[msgs.length - 1];
                  if (last && last.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, isStreaming: false, sources: data.sources };
                  }
                  return { messages: msgs, isStreaming: false };
                });
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
      
      // Ensure the message is finalized when the stream ends (even if 'done' event was missed)
      set((state) => {
        const msgs = [...state.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, isStreaming: false };
        }
        return { messages: msgs, isStreaming: false, activeController: null };
      });
      get().saveCurrentSession();
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('Chat stream error:', err);
      }
      set((state) => {
        const msgs = [...state.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, isStreaming: false, content: last.content || 'Error: Stream disconnected unexpectedly.' };
        }
        return { messages: msgs, isStreaming: false, activeController: null };
      });
      get().saveCurrentSession();
    });
  },

  stopStreaming: () => {
    const { activeController } = get();
    if (activeController) {
      activeController.abort();
    }
    set({ isStreaming: false, activeController: null });
  },

  saveCurrentSession: () => {
    set((state) => {
      if (state.messages.length === 0) return state;
      
      const id = state.activeSessionId || Date.now().toString();
      // Derive title from first user message
      const firstUserMsg = state.messages.find(m => m.role === 'user');
      const title = firstUserMsg ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '') : 'New Chat';
      
      const newSession: ChatSession = {
        id,
        title,
        messages: state.messages,
        updatedAt: Date.now()
      };
      
      const existingIndex = state.sessions.findIndex(s => s.id === id);
      const newSessions = [...state.sessions];
      if (existingIndex >= 0) {
        newSessions[existingIndex] = newSession;
      } else {
        newSessions.unshift(newSession);
      }
      
      return { sessions: newSessions, activeSessionId: id };
    });
  },

  loadSession: (id: string) => {
    const { stopStreaming } = get();
    stopStreaming();
    
    set((state) => {
      const session = state.sessions.find(s => s.id === id);
      if (session) {
        return { messages: session.messages, activeSessionId: id, isStreaming: false };
      }
      return state;
    });
  },

  deleteSession: (id: string) => {
    set((state) => {
      const newSessions = state.sessions.filter(s => s.id !== id);
      if (state.activeSessionId === id) {
        return { sessions: newSessions, messages: [], activeSessionId: null };
      }
      return { sessions: newSessions };
    });
  },

  clearChat: () => {
    const { stopStreaming, saveCurrentSession } = get();
    stopStreaming();
    saveCurrentSession();
    set({ messages: [], isStreaming: false, activeSessionId: null });
  }
}),
{
  name: 'smartnotes-chat-storage',
  partialize: (state) => ({ messages: state.messages, sessions: state.sessions, activeSessionId: state.activeSessionId }),
}
));
