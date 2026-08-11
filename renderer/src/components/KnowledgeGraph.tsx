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
        nodeLabel="label"
        nodeVal="val"
        nodeColor={() => 'var(--color-accent)'}
        linkColor={() => 'var(--color-border)'}
        linkWidth={(link: any) => Math.max(1, (link.value || 0.5) * 3)}
        onNodeClick={handleNodeClick}
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
