import React, { useState, useEffect, useCallback } from 'react';
import { useNotesStore } from '../store/notesStore';
import { Search, X } from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:8765/api/search';

interface SearchResult {
  note_id: string;
  title?: string;
  text?: string;
  score: number;
}

export const SearchPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const ipcToken = useNotesStore((s) => s.ipcToken);
  const setActiveNote = useNotesStore((s) => s.setActiveNote);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !ipcToken) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/?q=${encodeURIComponent(q)}`, {
        headers: { 'X-IPC-Token': ipcToken }
      });
      if (res.ok) {
        setResults(await res.json());
      }
    } catch (e) {
      console.error('Search failed:', e);
    }
    setIsSearching(false);
  }, [ipcToken]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex',
      justifyContent: 'center',
      paddingTop: '80px',
      zIndex: 'var(--z-modal)',
    }}>
      <div style={{
        width: '560px',
        maxHeight: '460px',
        backgroundColor: 'var(--color-bg-main)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-popover)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--color-border)',
          gap: '8px',
        }}>
          <Search size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Search notes..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-body)',
            }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={16} />
          </button>
        </div>
        
        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results.length === 0 && query && !isSearching && (
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-small)' }}>
              No results found
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={i}
              tabIndex={0}
              onClick={() => { setActiveNote(r.note_id); onClose(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setActiveNote(r.note_id); onClose(); } }}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                transition: 'var(--transition-fast)',
              }}
            >
              <div style={{ fontWeight: 500, fontSize: 'var(--font-size-body)' }}>{r.title || 'Untitled'}</div>
              {r.text && (
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.text.substring(0, 120)}...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
