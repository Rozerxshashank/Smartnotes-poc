import { create } from 'zustand';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { id: string; title: string }[];
  isStreaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  activeController: AbortController | null;
  addUserMessage: (content: string) => void;
  startStreaming: (query: string, ipcToken: string) => void;
  stopStreaming: () => void;
  clearChat: () => void;
}

const BACKEND_URL = 'http://127.0.0.1:8765/api/ask';

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  activeController: null,

  addUserMessage: (content: string) => {
    set((state) => ({
      messages: [...state.messages, { role: 'user', content }]
    }));
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

    const url = `${BACKEND_URL}/stream?q=${encodeURIComponent(query)}`;
    
    // Use fetch with ReadableStream for SSE since EventSource doesn't support custom headers
    fetch(url, {
      headers: { 'X-IPC-Token': ipcToken },
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
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('Chat stream error:', err);
      }
      set({ isStreaming: false, activeController: null });
    });
  },

  stopStreaming: () => {
    const { activeController } = get();
    if (activeController) {
      activeController.abort();
    }
    set({ isStreaming: false, activeController: null });
  },

  clearChat: () => {
    const { stopStreaming } = get();
    stopStreaming();
    set({ messages: [], isStreaming: false });
  }
}));
