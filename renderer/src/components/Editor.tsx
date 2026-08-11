import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useNotesStore } from '../store/notesStore';
import { WikilinkExtension } from './WikilinkExtension';
import { SlashCommand } from './SlashCommand';
import { EditorToolbar } from './EditorToolbar';

export const Editor: React.FC = () => {
  const activeNoteId = useNotesStore((state) => state.activeNoteId);
  const notes = useNotesStore((state) => state.notes);
  const updateActiveNote = useNotesStore((state) => state.updateActiveNote);
  const isDirty = useNotesStore((state) => state.isDirty);
  const setDirtyState = useNotesStore((state) => state.setDirtyState);
  
  const activeNote = notes.find((n) => n.id === activeNoteId);

  // Local state for debouncing
  const [localTitle, setLocalTitle] = useState('');

  const editor = useEditor({
    extensions: [StarterKit, WikilinkExtension, SlashCommand],
    content: activeNote ? activeNote.content : '',
    onUpdate: ({ editor }) => {
      // Autosave content changes
      const content = editor.getHTML();
      if (activeNote && content !== activeNote.content) {
        setDirtyState(true);
      }
    },
  });

  // Sync editor content when active note changes
  useEffect(() => {
    if (editor && activeNote) {
      if (editor.getHTML() !== activeNote.content) {
        editor.commands.setContent(activeNote.content);
      }
      setLocalTitle(activeNote.title);
    } else if (editor) {
      editor.commands.setContent('');
      setLocalTitle('');
    }
  }, [activeNoteId, editor]);

  // Debounced Autosave (1500ms)
  useEffect(() => {
    if (!activeNoteId || !editor) return;

    const handler = setTimeout(() => {
      const content = editor.getHTML();
      // Only call update if something actually changed from what's in the store
      if (activeNote && (localTitle !== activeNote.title || content !== activeNote.content)) {
        updateActiveNote(localTitle, content);
      }
    }, 1500);

    return () => clearTimeout(handler);
  }, [localTitle, editor?.getHTML(), activeNoteId, updateActiveNote, activeNote]);

  if (!activeNote) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--color-text-secondary)',
        fontFamily: 'inherit'
      }}>
        No notes yet — press ⌘N to create one
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-lg) var(--spacing-xl)', maxWidth: '800px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
        <input
          type="text"
          value={localTitle}
          onChange={(e) => {
            setLocalTitle(e.target.value);
            setDirtyState(true);
          }}
          style={{
            fontSize: 'var(--font-size-h1)',
            fontWeight: 'bold',
            color: 'var(--color-text-primary)',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            flex: 1
          }}
          placeholder="Note Title"
        />
        <div style={{
          fontSize: 'var(--font-size-small)',
          color: 'var(--color-text-secondary)',
          opacity: 0.8,
          marginTop: 'var(--spacing-sm)'
        }}>
          {isDirty ? 'Editing…' : 'Saved'}
        </div>
      </div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};
