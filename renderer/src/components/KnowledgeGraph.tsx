import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNotesStore } from '../store/notesStore';

const BACKEND_URL = 'http://127.0.0.1:8765/api/graph';

interface GraphNode {
  id: string;
  label: string;
  val: number;
}

interface GraphEdge {
  source: string;
  target: string;
  link_type: string;
  value: number;
}

export const KnowledgeGraph: React.FC = () => {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const ipcToken = useNotesStore((s) => s.ipcToken);
  const setActiveNote = useNotesStore((s) => s.setActiveNote);
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ForceGraph, setForceGraph] = useState<any>(null);
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  // Dynamically import react-force-graph-2d (it uses canvas, needs browser env)
  useEffect(() => {
    import('react-force-graph-2d').then((mod) => {
      setForceGraph(() => mod.default);
    });
  }, []);

  useEffect(() => {
    if (!ipcToken) return;
    fetch(`${BACKEND_URL}/`, {
      headers: { 'X-IPC-Token': ipcToken }
    })
      .then((r) => r.json())
      .then((data) => {
        setGraphData({
          nodes: data.nodes,
          edges: data.edges.map((e: GraphEdge) => ({ ...e, source: e.source, target: e.target }))
        });
      })
      .catch(console.error);
  }, [ipcToken]);

  const handleNodeClick = useCallback((node: any) => {
    setActiveNote(node.id);
  }, [setActiveNote]);

  if (!ForceGraph) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)' }}>
        Loading graph...
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-small)' }}>
        No notes to visualize yet
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ForceGraph
        ref={graphRef}
        graphData={{ nodes: graphData.nodes, links: graphData.edges }}
        nodeLabel={() => ''}
        nodeVal="val"
        linkColor={(link: any) => {
          if (!hoverNode) return 'var(--color-border)';
          return link.source.id === hoverNode.id || link.target.id === hoverNode.id 
            ? 'var(--color-accent)' 
            : 'rgba(150, 150, 150, 0.1)';
        }}
        linkWidth={(link: any) => {
          if (hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id)) return 3;
          return Math.max(1, (link.value || 0.5) * 2);
        }}
        linkDirectionalParticles={(link: any) => {
          if (hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id)) return 4;
          return 0;
        }}
        linkDirectionalParticleSpeed={0.005}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.label;
          const fontSize = 13 / globalScale;
          const size = Math.sqrt(node.val || 1) * 5;

          const isDark = document.body.style.backgroundColor !== 'rgb(255, 255, 255)' && matchMedia('(prefers-color-scheme: dark)').matches;
          const accentColor = isDark ? '#0a84ff' : '#007aff';
          const textColor = isDark ? '#f5f5f7' : '#1d1d1f';
          const bgColor = isDark ? '#1c1c1e' : '#ffffff';
          const dimColor = isDark ? '#3a3a3c' : '#e5e5ea';

          const isHovered = hoverNode?.id === node.id;
          const isNeighbor = hoverNode ? graphData.edges.some((e: any) => 
            (e.source.id === hoverNode.id && e.target.id === node.id) || 
            (e.target.id === hoverNode.id && e.source.id === node.id)
          ) : false;

          let nodeColor = accentColor;
          if (hoverNode && !isHovered && !isNeighbor) {
            nodeColor = dimColor;
          }

          if (isHovered) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 4/globalScale, 0, 2 * Math.PI, false);
            ctx.fillStyle = isDark ? 'rgba(10, 132, 255, 0.2)' : 'rgba(0, 122, 255, 0.2)';
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.fillStyle = nodeColor;
          ctx.fill();
          
          ctx.lineWidth = (isHovered ? 2.5 : 1.5) / globalScale;
          ctx.strokeStyle = bgColor;
          ctx.stroke();

          const currentTextColor = hoverNode && !isHovered && !isNeighbor ? (isDark ? '#48484a' : '#c7c7cc') : textColor;
          ctx.font = `${isHovered ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = currentTextColor;
          
          const labelYOffset = size + (isHovered ? 8/globalScale : 4/globalScale) + fontSize/2;
          ctx.fillText(label, node.x, node.y + labelYOffset);
        }}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: any) => setHoverNode(node || null)}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        cooldownTicks={100}
        width={containerRef.current?.clientWidth || 600}
        height={containerRef.current?.clientHeight || 400}
        backgroundColor="transparent"
      />
    </div>
  );
};
