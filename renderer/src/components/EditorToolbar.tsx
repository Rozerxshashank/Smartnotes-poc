import React from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Strikethrough, Code, 
  Heading1, Heading2, List, ListOrdered, Quote 
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    if (!editor) return;
    
    // Force re-render on transaction so stored marks (e.g. toggling bold before typing) update immediately
    const update = () => forceUpdate();
    editor.on('transaction', update);
    
    return () => {
      editor.off('transaction', update);
    };
  }, [editor]);

  if (!editor) return null;

  const btnStyle = (isActive: boolean) => ({
    background: isActive ? 'var(--color-accent)' : 'transparent',
    color: isActive ? '#fff' : 'var(--color-text-secondary)',
    border: 'none',
    padding: '6px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-fast)',
    outline: 'none'
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent editor from losing focus
  };

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: 'var(--spacing-sm) 0',
      marginBottom: 'var(--spacing-md)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0,
      background: 'var(--color-bg-main)',
      zIndex: 10
    }}>
      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleBold().run()}
        style={btnStyle(editor.isActive('bold'))}
        title="Bold (⌘B)"
      >
        <Bold size={16} />
      </button>
      
      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        style={btnStyle(editor.isActive('italic'))}
        title="Italic (⌘I)"
      >
        <Italic size={16} />
      </button>

      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        style={btnStyle(editor.isActive('strike'))}
        title="Strikethrough"
      >
        <Strikethrough size={16} />
      </button>

      <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 8px' }} />

      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        style={btnStyle(editor.isActive('heading', { level: 1 }))}
        title="Heading 1"
      >
        <Heading1 size={16} />
      </button>

      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        style={btnStyle(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
      >
        <Heading2 size={16} />
      </button>

      <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 8px' }} />

      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        style={btnStyle(editor.isActive('bulletList'))}
        title="Bullet List"
      >
        <List size={16} />
      </button>

      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        style={btnStyle(editor.isActive('orderedList'))}
        title="Ordered List"
      >
        <ListOrdered size={16} />
      </button>

      <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 8px' }} />

      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        style={btnStyle(editor.isActive('blockquote'))}
        title="Blockquote"
      >
        <Quote size={16} />
      </button>

      <button
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        style={btnStyle(editor.isActive('codeBlock'))}
        title="Code Block"
      >
        <Code size={16} />
      </button>
    </div>
  );
};
