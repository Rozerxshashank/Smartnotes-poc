import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { getSuggestionConfig } from './suggestion'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Image as ImageIcon
} from 'lucide-react'
import { type Note, formatRelativeTime } from '../types'

interface EditorProps {
  note: Note
  notes: Note[]
  onUpdate: (content: string) => void
  onRenameNote: (title: string) => void
  onNavigateNote: (id: string) => void
}

export const Editor: React.FC<EditorProps> = ({ note, notes, onUpdate, onRenameNote, onNavigateNote }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Mention.configure({
        HTMLAttributes: {
          class: 'wikilink cursor-pointer text-brand hover:underline decoration-brand/50 underline-offset-2 font-medium',
        },
        suggestion: getSuggestionConfig(notes),
        renderLabel({ node }) {
          return `[[${node.attrs.label ?? node.attrs.id}]]`
        }
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-4',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: note.content,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-neutral focus:outline-none max-w-none transition-colors duration-200 py-4',
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement
        if (target.classList.contains('wikilink')) {
            const id = target.getAttribute('data-id')
            if (id) {
               const targetNote = notes.find(n => n.title === id)
               if (targetNote) {
                 onNavigateNote(targetNote.id)
                 return true
               }
            }
        }
        return false
      }
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
  })

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && editor) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result) {
          editor.chain().focus().setImage({ src: result }).run()
        }
      }
      reader.readAsDataURL(file)
    }

    if (event.target) {
      event.target.value = ''
    }
  }

  useEffect(() => {
    if (editor && note) {
      const currentHTML = editor.getHTML()
      if (currentHTML !== note.content) {
        editor.commands.setContent(note.content || '')
      }
    }
  }, [note.id, editor])

  return (
    <div className="flex-1 h-full bg-white dark:bg-bg-dark overflow-y-auto overflow-x-hidden transition-colors duration-200 text-neutral-900 dark:text-neutral-100">
      <div className="max-w-3xl mx-auto py-16 px-10">
        {}
        <div className="mb-10">
          <input
            value={note.title}
            onChange={(e) => onRenameNote(e.target.value)}
            className="w-full bg-transparent text-[42px] font-bold text-neutral-900 dark:text-neutral-100 tracking-tight leading-tight focus:outline-none placeholder:text-neutral-200 dark:placeholder:text-neutral-800 border-none p-0"
            placeholder="Untitled"
          />
          <div className="mt-3 text-[13px] text-neutral-400 dark:text-neutral-500 font-medium tracking-tight">
            Edited {formatRelativeTime(note.lastModified)}
          </div>
        </div>

        {}
        {editor && (
          <div className="sticky top-2 z-20 flex flex-wrap items-center gap-0.5 mb-8 py-1 px-1 bg-white/80 dark:bg-bg-dark/80 backdrop-blur-md border border-neutral-100 dark:border-neutral-800 rounded-lg shadow-sm">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('bold') ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Bold"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('italic') ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Italic"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('underline') ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Underline"
            >
              <UnderlineIcon size={15} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('strike') ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Strikethrough"
            >
              <Strikethrough size={15} />
            </button>
            
            <div className="w-px h-4 bg-neutral-100 dark:bg-neutral-800 mx-1"></div>
            
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Heading 1"
            >
              <Heading1 size={15} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Heading 2"
            >
              <Heading2 size={15} />
            </button>
            
            <div className="w-px h-4 bg-neutral-100 dark:bg-neutral-800 mx-1"></div>

            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('bulletList') ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Bullet List"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('orderedList') ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Numbered List"
            >
              <ListOrdered size={15} />
            </button>
            
            <div className="w-px h-4 bg-neutral-100 dark:bg-neutral-800 mx-1"></div>

            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('blockquote') ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Block quote"
            >
              <Quote size={15} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run() }}
              className={`p-1.5 rounded-md transition-colors ${editor.isActive('codeBlock') ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Code Block"
            >
              <Code size={15} />
            </button>

            <div className="w-px h-4 bg-neutral-100 dark:bg-neutral-800 mx-1"></div>

            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click() }}
              className="p-1.5 rounded-md transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
              title="Insert Image"
            >
              <ImageIcon size={15} />
            </button>
          </div>
        )}

        {}
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleImageUpload} 
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

