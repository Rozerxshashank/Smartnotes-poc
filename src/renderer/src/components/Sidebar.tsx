import React, { useState, useRef, useEffect } from 'react'
import { Plus, Search, ChevronRight, Zap, FileUp, Trash2, Pencil, X, Sun, Moon } from 'lucide-react'
import { cn } from './lib/utils'
import { type Note } from '../types'

interface SidebarProps {
  notes: Note[]
  activeNoteId: string | null
  relatedNoteIds: string[]
  onSelectNote: (id: string) => void
  onAddNote: () => void
  onDeleteNote: (id: string) => void
  onRenameNote: (id: string, title: string) => void
  onImportDocument: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  activeNoteId,
  relatedNoteIds,
  onSelectNote,
  onAddNote,
  onDeleteNote,
  onRenameNote,
  onImportDocument,
  theme,
  toggleTheme
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const filteredNotes = searchQuery.trim()
    ? notes.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.replace(/<[^>]+>/g, '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const startRename = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation()
    setEditingId(note.id)
    setEditingTitle(note.title)
  }

  const commitRename = () => {
    if (editingId && editingTitle.trim()) {
      onRenameNote(editingId, editingTitle.trim())
    }
    setEditingId(null)
  }

  const cancelRename = () => {
    setEditingId(null)
  }

  return (
    <div className="w-64 h-full bg-bg-sidebar dark:bg-bg-sidebar-dark border-r border-neutral-200 dark:border-border-dark flex flex-col shrink-0 transition-colors duration-300">
      {}
      <div className="h-12 px-5 flex items-center border-b border-neutral-100 dark:border-border-dark transition-colors">
        <h1 className="font-semibold text-[15px] text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand" />
          SmartNotes
        </h1>
      </div>

      {}
      <div className="px-3 py-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 group-focus-within:text-neutral-500 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-white/50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-md py-1.5 pl-9 pr-4 text-[13px] focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 transition-all placeholder:text-neutral-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-sm cursor-pointer"
            >
              <X className="w-3 h-3 text-neutral-500" />
            </button>
          )}
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
        <div className="flex items-center justify-between px-2 py-2 mb-1 text-[11px] font-medium text-neutral-400 dark:text-neutral-500 tracking-tight">
          <span>ALL NOTES</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onImportDocument}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
              title="Import"
            >
              <FileUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onAddNote}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors text-brand cursor-pointer"
              title="New Note"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {filteredNotes.length === 0 && (
          <div className="px-3 py-6 text-center text-[13px] text-neutral-500">
            {searchQuery ? 'No results' : 'No notes yet'}
          </div>
        )}

        {filteredNotes.map((note) => {
          const isActive = activeNoteId === note.id
          const isRelated = relatedNoteIds.includes(note.id) && !isActive
          const isEditing = editingId === note.id

          return (
            <div
              key={note.id}
              onClick={() => !isEditing && onSelectNote(note.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-all group relative cursor-pointer",
                isActive
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200 dark:border-neutral-700 font-medium"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 hover:text-neutral-900 dark:hover:text-neutral-200 border border-transparent"
              )}
            >

              {isEditing ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onBlur={commitRename}
                    className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 text-[13px] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-brand"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="truncate text-left leading-tight">{note.title || 'Untitled'}</span>
                </div>
              )}

              {isRelated && !isEditing && (
                <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[9px] font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 shrink-0">
                  <Zap className="w-2.5 h-2.5" />
                  Related
                </div>
              )}

              {}
              {!isEditing && (
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-1">
                  <button
                    onClick={(e) => startRename(e, note)}
                    className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete "${note.title}"?`)) {
                        onDeleteNote(note.id)
                      }
                    }}
                    className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors text-neutral-400 hover:text-red-500 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {isActive && !isEditing && (
                <ChevronRight className="w-3 h-3 shrink-0 opacity-40 ml-1" />
              )}
            </div>
          )
        })}
      </div>

      {}
      <div className="p-4 border-t border-neutral-100 dark:border-border-dark transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-neutral-800 dark:text-neutral-100 truncate">Shashank Yadav</p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium tracking-tight">
              AI Powered
            </p>
          </div>
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

