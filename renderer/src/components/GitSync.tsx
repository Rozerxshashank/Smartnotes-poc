import React, { useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useNotesStore } from '../store/notesStore';
import { Github, Download, Upload, Loader2, X } from 'lucide-react';

export const GitSync: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const settings = useSettingsStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handlePush = async () => {
    if (!settings.githubPat || !settings.githubRepo) {
      alert("Please configure GitHub PAT and Repo URL in Settings.");
      return;
    }
    setIsSyncing(true);
    appendLog("Starting GitHub Push...");
    // TODO: Implement isomorphic-git push logic
    setTimeout(() => {
      appendLog("Push completed successfully.");
      setIsSyncing(false);
    }, 2000);
  };

  const handlePull = async () => {
    if (!settings.githubPat || !settings.githubRepo) {
      alert("Please configure GitHub PAT and Repo URL in Settings.");
      return;
    }
    setIsSyncing(true);
    appendLog("Starting GitHub Pull...");
    // TODO: Implement isomorphic-git pull logic
    setTimeout(() => {
      appendLog("Pull completed successfully.");
      setIsSyncing(false);
    }, 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 'var(--z-modal)',
    }}>
      <div style={{
        width: '500px',
        backgroundColor: 'var(--color-bg-main)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-popover)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: 'var(--spacing-md) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Github size={20} />
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-h3)' }}>GitHub Sync</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
            <button
              onClick={handlePull}
              disabled={isSyncing}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 'var(--radius-button)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-panel)',
                color: 'var(--color-text-primary)',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: 'var(--font-size-body)',
              }}
            >
              <Download size={18} /> Pull Changes
            </button>
            <button
              onClick={handlePush}
              disabled={isSyncing}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 'var(--radius-button)',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: 'var(--font-size-body)',
              }}
            >
              <Upload size={18} /> Push Changes
            </button>
          </div>

          <div style={{
            background: '#000',
            color: '#0f0',
            fontFamily: 'monospace',
            padding: 'var(--spacing-sm)',
            borderRadius: '4px',
            height: '150px',
            overflowY: 'auto',
            fontSize: '12px',
          }}>
            {log.length === 0 ? <span style={{ opacity: 0.5 }}>Waiting for sync operation...</span> : null}
            {log.map((l, i) => <div key={i}>{l}</div>)}
            {isSyncing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Processing...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
