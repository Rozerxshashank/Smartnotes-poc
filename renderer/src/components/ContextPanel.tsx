import React, { useState, useEffect } from 'react';
import { useNotesStore } from '../store/notesStore';
import { ChatPanel } from './ChatPanel';
import { KnowledgeGraph } from './KnowledgeGraph';
import { MessageSquare, Share2, Link } from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:8765/api/notes';

// For now, let's just make the ContextPanel switch between views.
export const ContextPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'related'>('chat');
  
  return (
    <div style={{
      width: '280px',
      height: '100%',
      backgroundColor: 'var(--color-bg-panel)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderLeft: '1px solid var(--color-border)',
      zIndex: 'var(--z-panel)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        paddingTop: 'env(safe-area-inset-top)', // For macOS traffic lights if needed on the right
      }}>
        <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={14} />} label="Chat" />
        <TabButton active={activeTab === 'graph'} onClick={() => setActiveTab('graph')} icon={<Share2 size={14} />} label="Graph" />
        <TabButton active={activeTab === 'related'} onClick={() => setActiveTab('related')} icon={<Link size={14} />} label="Related" />
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'chat' && <ChatPanel />}
        {activeTab === 'graph' && <KnowledgeGraph />}
        {activeTab === 'related' && <RelatedNotes />}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: 'var(--spacing-sm)',
      background: active ? 'var(--color-bg-main)' : 'transparent',
      border: 'none',
      borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
      color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      fontSize: 'var(--font-size-small)'
    }}
  >
    {icon} {label}
  </button>
);

const RelatedNotes: React.FC = () => {
  const activeNoteId = useNotesStore(s => s.activeNoteId);
  const ipcToken = useNotesStore(s => s.ipcToken);
  const setActiveNote = useNotesStore(s => s.setActiveNote);
  const [links, setLinks] = useState<{id: string, title: string}[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!activeNoteId || !ipcToken) {
      setLinks([]);
      return;
    }
    
    let isMounted = true;
    setLoading(true);
    
    fetch(`${BACKEND_URL}/${activeNoteId}/links`, {
      headers: { 'X-IPC-Token': ipcToken }
    })
      .then(res => res.json())
      .then(data => {
        if (isMounted && Array.isArray(data)) {
          setLinks(data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => { isMounted = false; };
  }, [activeNoteId, ipcToken]);
  
  if (!activeNoteId) {
    return (
      <div style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-small)', textAlign: 'center' }}>
        Select a note to see related links.
      </div>
    );
  }
  
  if (loading) {
    return <div style={{ padding: 'var(--spacing-md)', fontSize: 'var(--font-size-small)' }}>Loading...</div>;
  }
  
  if (links.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-small)', textAlign: 'center' }}>
        No related notes found. They will appear here when auto-linked or manually linked.
      </div>
    );
  }
  
  return (
    <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {links.map(link => (
        <div 
          key={link.id}
          onClick={() => setActiveNote(link.id)}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--color-bg-main)',
            borderRadius: 'var(--radius-button)',
            fontSize: 'var(--font-size-small)',
            cursor: 'pointer',
            border: '1px solid var(--color-border)',
            transition: 'var(--transition-fast)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        >
          {link.title}
        </div>
      ))}
    </div>
  );
};
