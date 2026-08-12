import React from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { Settings, Save, X } from 'lucide-react';

export const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const settings = useSettingsStore();

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
        width: '600px',
        maxHeight: '90vh',
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
            <Settings size={20} style={{ color: 'var(--color-accent)' }} />
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-h3)' }}>Settings</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 'var(--spacing-lg)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
          
          {/* AI Provider */}
          <section>
            <h3 style={{ fontSize: 'var(--font-size-body)', marginBottom: 'var(--spacing-md)' }}>AI Provider</h3>
            <select
              value={settings.aiProvider}
              onChange={(e) => settings.setAiProvider(e.target.value as any)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-button)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-panel)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              <option value="ollama">Ollama (Local - Requires installation)</option>
              <option value="gemini">Google Gemini (Cloud - Requires API Key)</option>
              <option value="mistral">Mistral AI (Cloud - Requires API Key)</option>
              <option value="openai">OpenAI (Cloud - Requires API Key)</option>
              <option value="sbert">SBERT Fallback (Local CPU - Embeddings only)</option>
            </select>
            
            {settings.aiProvider === 'openai' && (
              <input
                type="password"
                placeholder="OpenAI API Key"
                value={settings.openaiKey}
                onChange={(e) => settings.setOpenaiKey(e.target.value)}
                style={inputStyle}
              />
            )}
            
            {settings.aiProvider === 'mistral' && (
              <input
                type="password"
                placeholder="Mistral API Key"
                value={settings.mistralKey}
                onChange={(e) => settings.setMistralKey(e.target.value)}
                style={inputStyle}
              />
            )}
            
            {settings.aiProvider === 'gemini' && (
              <input
                type="password"
                placeholder="Gemini API Key"
                value={settings.geminiKey}
                onChange={(e) => settings.setGeminiKey(e.target.value)}
                style={inputStyle}
              />
            )}
          </section>

          {/* Auto-Linking */}
          <section>
            <h3 style={{ fontSize: 'var(--font-size-body)', marginBottom: 'var(--spacing-md)' }}>Auto-Linking Threshold</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.01"
                value={settings.autoLinkThreshold}
                onChange={(e) => settings.setAutoLinkThreshold(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ minWidth: '40px', fontWeight: 'bold' }}>{settings.autoLinkThreshold.toFixed(2)}</span>
            </div>
            <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
              Lower values create more links, higher values create fewer but more precise links.
            </p>
          </section>

        </div>

        <div style={{
          padding: 'var(--spacing-md) var(--spacing-lg)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'var(--color-bg-panel)'
        }}>
          <button
            onClick={() => {
              // TODO: Save to electron-store
              onClose();
            }}
            style={{
              padding: '8px 24px',
              borderRadius: 'var(--radius-button)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: 'var(--font-size-small)'
            }}
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: 'var(--radius-button)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-panel)',
  color: 'var(--color-text-primary)',
  boxSizing: 'border-box' as const,
};
