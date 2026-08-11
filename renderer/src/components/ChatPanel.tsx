import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { useNotesStore } from '../store/notesStore';
import { MessageSquare, Send, X, Loader2 } from 'lucide-react';

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const startStreaming = useChatStore((s) => s.startStreaming);
  const clearChat = useChatStore((s) => s.clearChat);
  const ipcToken = useNotesStore((s) => s.ipcToken);
  const setActiveNote = useNotesStore((s) => s.setActiveNote);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !ipcToken || isStreaming) return;
    startStreaming(input.trim(), ipcToken);
    setInput('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--color-bg-panel)',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-small)', fontWeight: 600 }}>
          <MessageSquare size={14} />
          Chat with Notes
        </div>
        <button onClick={clearChat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '2px' }}>
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-sm)' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-small)', padding: 'var(--spacing-xl)' }}>
            Ask a question about your notes
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-button)',
            backgroundColor: msg.role === 'user' ? 'var(--color-accent)' : 'transparent',
            color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
            fontSize: 'var(--font-size-small)',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
          }}>
            {msg.content}
            {msg.isStreaming && <Loader2 size={12} style={{ display: 'inline', marginLeft: '4px', animation: 'spin 1s linear infinite' }} />}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ marginTop: '6px', borderTop: '1px solid var(--color-border)', paddingTop: '4px', fontSize: '11px' }}>
                <span style={{ opacity: 0.7 }}>Sources: </span>
                {msg.sources.map((s, j) => (
                  <span
                    key={j}
                    onClick={() => setActiveNote(s.id)}
                    style={{ color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline', marginRight: '6px' }}
                  >
                    {s.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 'var(--spacing-sm)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        gap: '6px',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your notes..."
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 'var(--radius-button)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-small)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          style={{
            background: 'var(--color-accent)',
            border: 'none',
            borderRadius: 'var(--radius-button)',
            color: '#fff',
            padding: '6px 10px',
            cursor: 'pointer',
            opacity: isStreaming || !input.trim() ? 0.5 : 1,
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
