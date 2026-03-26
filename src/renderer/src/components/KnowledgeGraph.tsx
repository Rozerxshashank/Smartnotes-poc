import React, { useMemo, useRef, useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Note } from '../types'

interface KnowledgeGraphProps {
  notes: Note[]
  activeNoteId: string
  onSelectNode: (noteId: string) => void
  theme: 'dark' | 'light'
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ notes, activeNoteId, onSelectNode, theme }) => {
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const graphData = useMemo(() => {
    const nodes = notes.map(n => ({
      id: n.id,
      name: n.title,

      val: n.content.length > 500 ? 8 : 5 
    }))

    const links: any[] = []

    const mentionRegex = /<span[^>]+data-type="mention"[^>]+data-id="([^"]+)"/g

    notes.forEach(note => {
      const matches = [...note.content.matchAll(mentionRegex)]
      matches.forEach(match => {
        const targetTitle = match[1]
        const targetNote = notes.find(n => n.title === targetTitle)
        
        if (targetNote && targetNote.id !== note.id) {
          if (!links.some(l => l.source === note.id && l.target === targetNote.id)) {
             links.push({
               source: note.id,
               target: targetNote.id
             })
          }
        }
      })
    })

    return { nodes, links }
  }, [notes])

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {

      fgRef.current.d3Force('charge')?.strength(-200)
      fgRef.current.d3Force('link')?.distance(120)
      fgRef.current.d3Force('center')?.strength(0.15)
    }
  }, [graphData])

  const linkColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'

  return (
    <div ref={containerRef} className="w-full h-full relative flex flex-col items-center justify-center bg-white dark:bg-bg-dark touch-none select-none overflow-hidden">
       {}
       <div 
         className="absolute inset-0 pointer-events-none opacity-[0.4] dark:opacity-[0.12] transition-opacity duration-300"
         style={{ 
           backgroundImage: theme === 'dark' 
             ? 'radial-gradient(circle at 1.5px 1.5px, #ffffff 1.5px, transparent 0)' 
             : 'radial-gradient(circle at 1.5px 1.5px, #000000 1.5px, transparent 0)',
           backgroundSize: '32px 32px' 
         }} 
       />

       {}
       <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0_150px_rgba(0,0,0,0.3)]" />

       {graphData.nodes.length === 0 ? (
         <div className="flex flex-col items-center gap-3 relative z-10">
           <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
             <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 rounded-full border-dashed" />
           </div>
           <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium tracking-tight">No linked notes yet</p>
         </div>
       ) : (
         <ForceGraph2D
           ref={fgRef}
           width={dimensions.width}
           height={dimensions.height}
           graphData={graphData}
           nodeId="id"
           nodeLabel="none"
           backgroundColor="rgba(0,0,0,0)"
           linkColor={() => linkColor}
           linkWidth={1.5}
           nodeRelSize={6}
           onNodeClick={(node: any) => {
             onSelectNode(node.id)
           }}
           nodeCanvasObject={(node: any, ctx, globalScale) => {
             const label = node.name
             const fontSize = 11.5 / globalScale
             ctx.font = `500 ${fontSize}px Inter, sans-serif`
             const isActive = node.id === activeNoteId

             if (isActive) {
               ctx.beginPath()
               ctx.arc(node.x, node.y, node.val + 6/globalScale, 0, 2 * Math.PI, false)
               ctx.fillStyle = theme === 'dark' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.15)'
               ctx.fill()
             }

             ctx.beginPath()
             ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false)
             ctx.fillStyle = isActive 
               ? '#0ea5e9' 
               : (theme === 'dark' ? '#52525b' : '#a1a1aa')

             ctx.shadowColor = theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)'
             ctx.shadowBlur = 10 / globalScale
             ctx.fill()

             ctx.lineWidth = 1.5 / globalScale
             ctx.strokeStyle = theme === 'dark' ? '#18181b' : '#ffffff'
             ctx.stroke()
             
             ctx.shadowColor = 'transparent'

             const textWidth = ctx.measureText(label).width
             const paddingX = fontSize * 1.2
             const paddingY = fontSize * 0.8
             const bgWidth = textWidth + paddingX
             const bgHeight = fontSize + paddingY
             
             ctx.fillStyle = theme === 'dark' ? 'rgba(24, 24, 27, 0.75)' : 'rgba(255, 255, 255, 0.75)'
             
             const labelYOffset = node.val + (8 / globalScale)
             const bgX = node.x - bgWidth / 2
             const bgY = node.y + labelYOffset - bgHeight / 2
             
             ctx.beginPath()
             if (ctx.roundRect) {
                 ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 4 / globalScale)
             } else {
                 ctx.rect(bgX, bgY, bgWidth, bgHeight)
             }
             ctx.fill()

             ctx.lineWidth = 0.5 / globalScale
             ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
             ctx.stroke()

             ctx.textAlign = 'center'
             ctx.textBaseline = 'middle'
             ctx.fillStyle = isActive 
                ? (theme === 'dark' ? '#38bdf8' : '#0284c7') 
                : (theme === 'dark' ? '#d4d4d8' : '#52525b')
             ctx.fillText(label, node.x, node.y + labelYOffset)
           }}
         />
       )}
       
       {}
       <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-4 bg-white/70 dark:bg-neutral-800/70 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-700/50 px-5 py-2.5 rounded-full shadow-lg pointer-events-none transition-colors z-10 w-auto">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-2 h-2 rounded-full bg-brand" />
            <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-200">Current Note</span>
          </div>
          <div className="w-px h-3 bg-neutral-300 dark:bg-neutral-600 shrink-0" />
          <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Scroll to zoom. Drag to pan.</span>
       </div>
    </div>
  )
}

