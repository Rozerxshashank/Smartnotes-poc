import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { AIChat } from './components/AIChat'
import { KnowledgeGraph } from './components/KnowledgeGraph'
import { Sparkles, PanelRightOpen, PanelRightClose, RefreshCcw, Network } from 'lucide-react'
import { chunkText, generateEmbedding } from './lib/ai'
import { updateNoteEmbeddings, getStore, cosineSimilarity } from './lib/vectorStore'
import { type Note } from './types'

const INITIAL_NOTES: Note[] = [
  {
    id: '1',
    title: 'Smartnote Guide',
    content: `<h1>Smartnote Guide</h1>
<p>This is a guide to help you set up and use SmartNotes properly.</p>
<p>First, you need to make sure you have the Ollama app running on your computer. SmartNotes uses Ollama to handle all the AI thinking right on your local machine. This keeps your data private because nothing is ever sent to a cloud server.</p>
<p>Once Ollama is running, you can start typing notes in the editor. The app will automatically save your work as you go. You can also use the sidebar to see related notes that the app suggests while you write.</p>
<p>To use the AI chat, just open the assistant panel on the right. You can ask questions about your notes or ask for summaries. The AI will look through your own files and give you an answer with clickable links to the notes it used as a source.</p>
<p>This app also has a knowledge graph view. You can see a visual map of how your ideas are connected. This helps you find connections that you might have missed before.</p>
<p>SmartNotes is built to be fast and private. I hope this guide helps you get started with building your own digital brain.</p>`,
    lastModified: new Date()
  }
]

function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('smartnotes_v1_notes')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map((n: any) => ({
          ...n,
          lastModified: new Date(n.lastModified)
        }))
      } catch (e) {
        console.error('Failed to parse notes:', e)
        return INITIAL_NOTES
      }
    }
    return INITIAL_NOTES
  })
  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    return localStorage.getItem('smartnotes_v1_active_id') || INITIAL_NOTES[0].id
  })
  const [showAIChat, setShowAIChat] = useState(false)
  const [aiChatWidth, setAiChatWidth] = useState(400)
  const [showGraphView, setShowGraphView] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [relatedNoteIds, setRelatedNoteIds] = useState<string[]>([])
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    localStorage.setItem('smartnotes_v1_notes', JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    localStorage.setItem('smartnotes_v1_active_id', activeNoteId)
  }, [activeNoteId])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.style.backgroundColor = '#0f1115'
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.backgroundColor = '#ffffff'
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0]

  const handleSelectNote = (id: string) => {
    setActiveNoteId(id)
  }

  const handleAddNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
      lastModified: new Date()
    }
    setNotes(prev => [newNote, ...prev])
    setActiveNoteId(newNote.id)
  }

  const handleUpdateNoteContent = useCallback((content: string) => {
    setNotes(prev => prev.map(n =>
      n.id === activeNoteId ? { ...n, content, lastModified: new Date() } : n
    ))
  }, [activeNoteId])

  const handleRenameNote = (id: string, title: string) => {
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, title, lastModified: new Date() } : n
    ))
  }

  const handleDeleteNote = (id: string) => {
    if (notes.length <= 1) return
    const remaining = notes.filter(n => n.id !== id)
    setNotes(remaining)
    if (activeNoteId === id) {
      setActiveNoteId(remaining[0].id)
    }
  }

  const handleImportDocument = async () => {

    if (window.api?.importDocument) {
      try {
        const result = await window.api.importDocument()
        if (!result) return

        let text = result.content || ''
        const title = result.title.replace(/\.[^.]+$/, '')

        if (result.rawData && result.extension) {
          const bytes = result.rawData as Uint8Array

          if (result.extension === 'pdf') {
            const pdfjsLib = await import('pdfjs-dist')


            const workerUrl = await import('pdfjs-dist/build/pdf.worker.mjs?url')
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default
            
            const pdf = await pdfjsLib.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise
            const pages: string[] = []
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i)
              const content = await page.getTextContent()
              const pageText = content.items.map((item: any) => item.str).join(' ')
              pages.push(pageText)
            }
            text = pages.join('\n\n')
          } else if (result.extension === 'docx' || result.extension === 'doc') {
            const mammoth = await import('mammoth')
            const res = await mammoth.extractRawText({ arrayBuffer: bytes.buffer as ArrayBuffer })
            text = res.value
          }
        }

        const newNote: Note = {
          id: Date.now().toString(),
          title,
          content: `<h1>${title}</h1><p>${text.replace(/\n/g, '</p><p>')}</p>`,
          lastModified: new Date()
        }
        setNotes(prev => [newNote, ...prev])
        setActiveNoteId(newNote.id)
      } catch (error: any) {
        console.error('Import failed:', error)
        alert('Failed to import document. Error details: ' + (error?.message || String(error)) + '\nStack: ' + (error?.stack || ''))
      }
      return
    }

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.txt,.pdf,.doc,.docx'
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        let text = ''
        const fileName = file.name

        if (file.name.endsWith('.txt')) {
          text = await file.text()
        } else if (file.name.endsWith('.pdf')) {

          const pdfjsLib = await import('pdfjs-dist')
          pdfjsLib.GlobalWorkerOptions.workerSrc = ''
          const buffer = await file.arrayBuffer()
          const pdf = await pdfjsLib.getDocument({ data: buffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise
          const pages: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            const pageText = content.items.map((item: any) => item.str).join(' ')
            pages.push(pageText)
          }
          text = pages.join('\n\n')
        } else {
          text = await file.text()
        }

        const newNote: Note = {
          id: Date.now().toString(),
          title: fileName.replace(/\.[^.]+$/, ''),
          content: `<h1>${fileName.replace(/\.[^.]+$/, '')}</h1><p>${text.replace(/\n/g, '</p><p>')}</p>`,
          lastModified: new Date()
        }
        setNotes(prev => [newNote, ...prev])
        setActiveNoteId(newNote.id)
      } catch (error) {
        console.error('Import failed:', error)
        alert('Failed to import document.')
      }
    }
    fileInput.click()
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!activeNote || !activeNote.content.trim()) return

      setIsSyncing(true)
      try {

        const plainText = activeNote.content.replace(/<[^>]+>/g, ' ').trim()
        if (!plainText) return

        const chunks = chunkText(plainText)
        const nodes = await Promise.all(
          chunks.map(async (text) => ({
            noteId: activeNote.id,
            text,
            embedding: await generateEmbedding(text)
          }))
        )

        const validNodes = nodes.filter(n => n.embedding.length > 0)
        if (validNodes.length === 0) return

        updateNoteEmbeddings(activeNote.id, validNodes)

        const activeVectorSize = validNodes[0].embedding.length
        const activeMean = new Array(activeVectorSize).fill(0)
        validNodes.forEach(node => {
          node.embedding.forEach((val, i) => activeMean[i] += val / validNodes.length)
        })

        const store = getStore()
        const otherNoteIds = [...new Set(store.map(n => n.noteId).filter(id => id !== activeNote.id))]

        const related: string[] = []
        for (const otherId of otherNoteIds) {
          const otherNodes = store.filter(n => n.noteId === otherId)
          if (otherNodes.length === 0) continue

          const otherMean = new Array(activeVectorSize).fill(0)
          otherNodes.forEach(node => {
            node.embedding.forEach((val, i) => otherMean[i] += val / otherNodes.length)
          })

          const sim = cosineSimilarity(activeMean, otherMean)
          if (sim > 0.6) related.push(otherId)
        }
        setRelatedNoteIds(related)
      } catch (error) {
        console.error('AI Sync Error:', error)
      } finally {
        setIsSyncing(false)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [activeNote?.content, activeNote?.id])

  return (
    <div className="flex h-screen w-screen bg-bg-sidebar dark:bg-bg-sidebar-dark text-neutral-900 dark:text-neutral-100 overflow-hidden font-inter transition-colors duration-300">
      <Sidebar
        notes={notes}
        activeNoteId={activeNoteId}
        relatedNoteIds={relatedNoteIds}
        onSelectNote={handleSelectNote}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        onRenameNote={handleRenameNote}
        onImportDocument={handleImportDocument}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-white dark:bg-bg-dark text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
        <header className="h-12 border-b border-neutral-100 dark:border-border-dark flex items-center justify-between px-6 bg-white dark:bg-bg-dark z-10 shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
             {isSyncing && (
               <div className="flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500 font-medium tracking-tight shrink-0">
                 <RefreshCcw className="w-3 h-3 animate-spin duration-[2000ms]" />
                 Updating index...
               </div>
             )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowGraphView(!showGraphView)}
              className={`h-8 px-3 rounded-md transition-all flex items-center gap-2 text-[13px] font-medium cursor-pointer border ${
                showGraphView
                  ? 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-brand'
                  : 'bg-transparent border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              className={`h-8 px-3 rounded-md transition-all flex items-center gap-2 text-[13px] font-medium cursor-pointer border ${
                showAIChat
                  ? 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-brand'
                  : 'bg-transparent border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assistant</span>
              {showAIChat ? <PanelRightClose className="w-3.5 h-3.5 ml-0.5 opacity-50" /> : <PanelRightOpen className="w-3.5 h-3.5 ml-0.5 opacity-50" />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {showGraphView ? (
            <KnowledgeGraph
              notes={notes}
              activeNoteId={activeNoteId}
              theme={theme}
              onSelectNode={(id) => {
                handleSelectNote(id)
                setShowGraphView(false)
              }}
            />
          ) : (
            <Editor
              note={activeNote}
              notes={notes}
              onUpdate={handleUpdateNoteContent}
              onRenameNote={(title) => handleRenameNote(activeNote.id, title)}
              onNavigateNote={(id) => handleSelectNote(id)}
            />
          )}
        </div>
      </div>

      {showAIChat && (
        <div className="flex z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] shrink-0">
          <div 
            className="w-1 cursor-col-resize hover:bg-brand/50 active:bg-brand z-30 transition-colors bg-transparent relative -mx-[2px] shrink-0"
            onMouseDown={(e) => {
               e.preventDefault()
               const startX = e.clientX
               const startWidth = aiChatWidth
               
               const onMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = startX - moveEvent.clientX
                  const newWidth = Math.min(Math.max(startWidth + deltaX, 300), 800)
                  setAiChatWidth(newWidth)
               }
               
               const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove)
                  document.removeEventListener('mouseup', onMouseUp)
                  document.body.style.cursor = 'default'
               }
               
               document.addEventListener('mousemove', onMouseMove)
               document.addEventListener('mouseup', onMouseUp)
               document.body.style.cursor = 'col-resize'
            }}
          />
          <div style={{ width: `${aiChatWidth}px` }} className="shrink-0 bg-bg-sidebar dark:bg-bg-sidebar-dark relative overflow-hidden flex flex-col border-l border-transparent">
            <AIChat 
              onClose={() => setShowAIChat(false)} 
              notes={notes}
              onNavigateNote={(id) => {
                handleSelectNote(id)
                setShowAIChat(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App

