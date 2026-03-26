import React, { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, X, Brain, Info, Trash2 } from 'lucide-react'
import { cn } from './lib/utils'
import { generateEmbedding } from '../lib/ai'
import { searchSimilarChunks } from '../lib/vectorStore'
import axios from 'axios'

import { Note } from '../types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIChatProps {
  onClose: () => void
  notes: Note[]
  onNavigateNote: (noteId: string) => void
}

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const AIChat: React.FC<AIChatProps> = ({ onClose, notes, onNavigateNote }) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('smartnotes_v1_chat_messages')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      } catch (e) {
        console.error('Failed to parse chat messages:', e)
      }
    }
    return [
      {
        id: '1',
        role: 'assistant',
        content: "Hi, How can I help?",
        timestamp: new Date()
      }
    ]
  })
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'ready' | 'missing'>('checking')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem('smartnotes_v1_chat_messages', JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  useEffect(() => {
    const checkOllama = async () => {
      try {
        await axios.get('http://localhost:11434/api/tags')
        setOllamaStatus('ready')
      } catch {
        setOllamaStatus('missing')
      }
    }
    checkOllama()
  }, [])

  const [lastContext, setLastContext] = useState<string>('')
  const [lastTopic, setLastTopic] = useState<string>('')

  const handleClearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: "Chat cleared. How can I help you with your notes?",
      timestamp: new Date()
    }])
    setLastContext('')
    setLastTopic('')
  }

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    const currentInput = input
    setInput('')
    setIsTyping(true)

    try {

      const augmentedQuery = lastTopic ? `${lastTopic} ${currentInput}` : currentInput
      const queryEmbedding = await generateEmbedding(augmentedQuery)
      let responseContent = ''

      if (queryEmbedding.length === 0) {
        responseContent = 'The local AI model is still loading. Please wait a moment and try again.'
      } else {

        const contextChunks = searchSimilarChunks(queryEmbedding, 4)

        const lowercaseInput = currentInput.toLowerCase()
        const titleMatchNotes = notes.filter(n =>
          lowercaseInput.includes(n.title.toLowerCase()) ||
          n.title.toLowerCase().includes(lowercaseInput)
        )

        const seenNoteIds = new Set<string>()
        const contextEntries: string[] = []
        let currentTopicFound = lastTopic

        titleMatchNotes.forEach(n => {
          if (!seenNoteIds.has(n.id)) {
            const plainText = n.content.replace(/<[^>]+>/g, ' ').trim()
            contextEntries.push(`Note Title: "${n.title}"\nContent: ${plainText}`)
            seenNoteIds.add(n.id)
            currentTopicFound = n.title
          }
        })

        contextChunks.forEach(c => {
          if (c.score > 0.25) {
            const parentNote = notes.find(n => n.id === c.noteId)
            if (parentNote) {
              const entry = `Note Title: "${parentNote.title}"\nContent Snippet: ${c.text}`
              if (!contextEntries.some(e => e.includes(`"${parentNote.title}"`) && e.includes(c.text.slice(0, 20)))) {
                contextEntries.push(entry)
                if (!currentTopicFound) currentTopicFound = parentNote.title
              }
            }
          }
        })

        let currentContext = contextEntries.join('\n\n---\n\n')


        if (!currentContext && lastContext) {
          currentContext = lastContext
          currentTopicFound = lastTopic
        }

        setLastContext(currentContext)
        setLastTopic(currentTopicFound)

        if (ollamaStatus === 'ready') {
          const systemPrompt = `You are an expert-level AI research assistant for SmartNotes.
TONE: Straightforward, analytical, and direct.
CRITICAL: Do not use conversational filler (e.g., "I'd be happy to help", "Here is what I found").
Go directly to the information. Be intelligent and precise.

CONTEXT: You have full access to the user's local notes database provided below.
CURRENT TOPIC: "${currentTopicFound || 'General'}"

User's Local Notes Context:
${currentContext || '(No relevant notes found)'}

INSTRUCTIONS:
1. If the answer is in the context, provide it directly and intelligently.
2. **CITATIONS**: When you use information from a note, you MUST cite it at the end of the sentence or paragraph using the exact format: [[Note Title]].
3. If the user asks for suggestions, provide professional, expert-level advice.
4. If no relevant info is found, state that clearly without apologizing.`

          const chatMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...updatedMessages.slice(-8).map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            }))
          ]

          const response = await axios.post('http://localhost:11434/api/chat', {
            model: 'llama3.2:latest',
            messages: chatMessages,
            stream: false
          })
          responseContent = response.data.message.content
        } else {
          if (currentContext) {
            responseContent = `I found some relevant info in your local notes, but Ollama is offline. Topic: ${currentTopicFound}\n\n${currentContext.slice(0, 800)}`
          } else {
            responseContent = `Ollama is offline and I couldn't find a direct match in your notes.`
          }
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date()
      }])
    } catch (error) {
      console.error('RAG Error:', error)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "An error occurred. Please check that Ollama is running and try again.",
        timestamp: new Date()
      }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="w-full h-full bg-bg-sidebar dark:bg-bg-sidebar-dark border-l border-neutral-200 dark:border-border-dark flex flex-col shrink-0 transition-colors duration-300">
      {}
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-100 dark:border-border-dark shrink-0 transition-colors">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-neutral-100 dark:bg-neutral-800 rounded">
            <Brain className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
          </div>
          <div>
            <h2 className="font-semibold text-[13px] text-neutral-800 dark:text-neutral-100 leading-none">Assistant</h2>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleClearChat}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
            title="Clear Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {}
      {ollamaStatus === 'missing' && (
        <div className="mx-4 my-3 p-2.5 bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-md flex gap-2.5 items-start shrink-0">
          <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
            Ollama not detected. Start Ollama locally for AI features.
          </p>
        </div>
      )}

      {}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col gap-1.5 max-w-[92%]",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className={cn(
              "p-3 rounded-lg text-[13px] leading-relaxed transition-colors relative group",
              msg.role === 'user'
                ? "bg-neutral-800 dark:bg-neutral-700 text-white shadow-sm"
                : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 shadow-sm"
            )}>
              {msg.role === 'assistant' ? (
                <div className="markdown-content prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({children}) => {

                        const parts = React.Children.toArray(children).flatMap(child => {
                          if (typeof child !== 'string') return [child]
                          
                          const regex = /\[\[(.*?)\]\]/g
                          const elements: React.ReactNode[] = []
                          let lastIndex = 0
                          let match

                          while ((match = regex.exec(child)) !== null) {
                            if (match.index > lastIndex) {
                              elements.push(child.substring(lastIndex, match.index))
                            }
                            
                            const title = match[1]
                            const targetNote = notes.find(n => n.title === title)
                            
                            elements.push(
                              <button
                                key={match.index}
                                onClick={() => targetNote && onNavigateNote(targetNote.id)}
                                className={cn(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded border text-[11px] font-medium transition-all",
                                  targetNote 
                                    ? "bg-brand/10 border-brand/20 text-brand hover:bg-brand/20 cursor-pointer"
                                    : "bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed"
                                )}
                              >
                                <Info className="w-2.5 h-2.5" />
                                {title}
                              </button>
                            )
                            lastIndex = regex.lastIndex
                          }

                          if (lastIndex < child.length) {
                            elements.push(child.substring(lastIndex))
                          }
                          return elements
                        })

                        return <p>{parts}</p>
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 px-1 font-medium tracking-tight">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500 text-[11px] font-medium p-2 animate-pulse">
            <Sparkles className="w-3 h-3" />
            Generating...
          </div>
        )}
      </div>

      {}
      <div className="px-4 py-5 border-t border-neutral-100 dark:border-border-dark shrink-0 transition-colors">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Write a message..."
            className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md py-2.5 pl-3.5 pr-10 text-[13px] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 transition-all resize-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600 shadow-sm"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            ollamaStatus === 'ready' ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-700'
          )} />
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-tight font-semibold">
            {ollamaStatus === 'ready' ? 'Ready' : 'Offline'}
          </p>
        </div>
      </div>
    </div>
  )
}

