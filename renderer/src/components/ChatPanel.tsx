import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { useNotesStore } from '../store/notesStore';
import { MessageSquare, Send, Plus, Loader2, History, Trash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const startStreaming = useChatStore((s) => s.startStreaming);
  const clearChat = useChatStore((s) => s.clearChat);
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const loadSession = useChatStore((s) => s.loadSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  
  const ipcToken = useNotesStore((s) => s.ipcToken);
  const setActiveNote = useNotesStore((s) => s.setActiveNote);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !ipcToken || isStreaming) return;
    startStreaming(input.trim(), ipcToken);
    setInput('');
  };

  const preprocessMarkdown = (text: string) => {
    // Replace [Note: Title] with a markdown link so ReactMarkdown can parse it
    return text.replace(/\[Note:\s*([^\]]+)\]/g, '[$1](note:$1)');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--color-bg-panel)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            title="Chat History"
            style={{ 
              background: showHistory ? 'var(--color-bg-main)' : 'transparent',
              border: showHistory ? '1px solid var(--color-border)' : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer', 
              color: 'var(--color-text-secondary)', 
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <History size={14} /> History
          </button>
          
          <button 
            onClick={() => { clearChat(); setShowHistory(false); }} 
            title="New Chat"
            style={{ 
              background: 'var(--color-bg-main)', 
              border: '1px solid var(--color-border)', 
              borderRadius: '6px',
              cursor: 'pointer', 
              color: 'var(--color-text-primary)', 
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 500,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Plus size={14} /> New Chat
          </button>
        </div>
      </div>

      {/* Content Area */}
      {showHistory ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-md)' }}>
          <div style={{ marginBottom: '16px', fontSize: 'var(--font-size-small)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Previous Chats</div>
          {sessions.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '32px' }}>
              No chat history found.
            </div>
          )}
          {sessions.map(s => (
            <div 
              key={s.id} 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '10px 12px', 
                background: s.id === activeSessionId ? 'var(--color-bg-main)' : 'transparent', 
                border: s.id === activeSessionId ? '1px solid var(--color-accent)' : '1px solid transparent',
                borderRadius: '8px', 
                marginBottom: '8px', 
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
              onMouseEnter={(e) => { if (s.id !== activeSessionId) e.currentTarget.style.background = 'var(--color-bg-main)'; }}
              onMouseLeave={(e) => { if (s.id !== activeSessionId) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { loadSession(s.id); setShowHistory(false); }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: '8px' }}>
                <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: s.id === activeSessionId ? 600 : 400 }}>{s.title}</span>
                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{new Date(s.updatedAt).toLocaleString()}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} 
                style={{ background: 'none', border: 'none', color: '#ff453a', cursor: 'pointer', opacity: 0.7, padding: '4px' }}
                title="Delete Chat"
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-small)', padding: 'var(--spacing-xl)' }}>
            Ask a question about your notes
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, href, children, ...props }) => {
                  if (href?.startsWith('note:')) {
                    const title = decodeURIComponent(href.replace('note:', ''));
                    const source = msg.sources?.find((s: any) => s.title === title) || msg.sources?.find((s: any) => s.title.includes(title));
                    if (source) {
                      return (
                        <span 
                          onClick={() => setActiveNote(source.id)}
                          className="citation-badge"
                          title="Click to open note"
                        >
                          {title}
                        </span>
                      );
                    }
                    return <strong style={{ color: 'var(--color-accent)' }}>{title}</strong>;
                  }
                  return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
                }
              }}
            >
              {preprocessMarkdown(msg.content)}
            </ReactMarkdown>
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
      )}

      {/* Input */}
      <div style={{
        padding: 'var(--spacing-md)',
        background: 'transparent',
      }}>
        <div className="chat-input-wrapper">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your notes..."
            className="chat-input"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="chat-send-btn"
            style={{
              background: 'var(--color-accent)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              opacity: isStreaming || !input.trim() ? 0.5 : 1,
              transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
              marginBottom: '2px',
              marginRight: '2px',
              boxShadow: 'var(--shadow-sm)',
              transform: isStreaming ? 'scale(0.9)' : 'scale(1)',
            }}
          >
            <Send size={15} style={{ marginLeft: '-1px' }} />
          </button>
        </div>
      </div>
      <style>
        {`
          .chat-send-btn:hover:not(:disabled) {
            transform: scale(1.05) translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
            background: linear-gradient(135deg, var(--color-accent), #3395ff);
          }
          .chat-send-btn:active:not(:disabled) {
            transform: scale(0.95);
          }
        `}
      </style>
    </div>
  );
};
